import { useEffect, useRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Attachment, CakeObject } from "../../domain/models";
import {
  assetById,
  attachmentFromPoint,
  worldDirectionToModel,
  worldPointToModel,
} from "../../domain/cakeScene";
import { placementOf, type SceneContext } from "./placement";

export type SceneApi = {
  // Surface points near the middle of the current view, for click-to-add.
  scatter(assetId: string, count: number): Attachment[];
  // A surface point a short distance beside an existing attachment.
  beside(object: CakeObject): Attachment | null;
};
type Gizmo = { axis: string | null; dragging: boolean };
type Props = {
  objects: CakeObject[];
  context: SceneContext;
  selection: string[];
  tool: string;
  // The active transform gizmo, if any (three-stdlib TransformControls).
  gizmo: RefObject<object | null>;
  api?: RefObject<SceneApi | null>;
  onSelect?: (id: string | null, additive: boolean) => void;
  onObjectChange?: (o: CakeObject) => void;
  onPlace?: (assetId: string, attachment: Attachment) => void;
  onPreview: (o: CakeObject | null) => void;
};
type SurfaceHit = {
  surface: { type: "tier" | "model"; id: string };
  point: THREE.Vector3;
  normal: THREE.Vector3;
};

function sceneIdOf(hit: THREE.Intersection) {
  if (hit.instanceId !== undefined && hit.object.userData.instanceIds)
    return hit.object.userData.instanceIds[hit.instanceId] as string;
  for (let o: THREE.Object3D | null = hit.object; o; o = o.parent)
    if (o.userData.sceneId) return o.userData.sceneId as string;
  return null;
}

// Smooth vertex normal at the hit, in world space. Face normals alone make a
// dragged flower twitch across every triangle of a detailed frosting mesh.
function hitNormal(hit: THREE.Intersection) {
  const mesh = hit.object as THREE.Mesh,
    normals = mesh.geometry.getAttribute("normal"),
    positions = mesh.geometry.getAttribute("position"),
    normal = new THREE.Vector3();
  if (hit.face && normals) {
    const [a, b, c] = [hit.face.a, hit.face.b, hit.face.c];
    THREE.Triangle.getInterpolation(
      mesh.worldToLocal(hit.point.clone()),
      new THREE.Vector3().fromBufferAttribute(positions, a),
      new THREE.Vector3().fromBufferAttribute(positions, b),
      new THREE.Vector3().fromBufferAttribute(positions, c),
      new THREE.Vector3().fromBufferAttribute(normals, a),
      new THREE.Vector3().fromBufferAttribute(normals, b),
      new THREE.Vector3().fromBufferAttribute(normals, c),
      normal,
    );
  }
  if (normal.lengthSq() < 1e-8 && hit.face) normal.copy(hit.face.normal);
  return normal
    .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld))
    .normalize();
}

// One controller owns picking and dragging so selection, surface movement,
// camera orbit and the transform gizmo never compete for the same gesture.
export function Interaction(props: Props) {
  const { gl, camera, scene } = useThree(),
    get = useThree((s) => s.get),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const canvas = gl.domElement,
      host = canvas.parentElement ?? canvas,
      raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
    const aim = (x: number, y: number) => {
      // The canvas renders on demand, so transforms may not have been
      // refreshed since the last edit or asset load. Raycast current ones.
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      const rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          (-(y - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
    };
    const meshes = (accept: (o: THREE.Object3D) => boolean) => {
      const found: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        if ((o as THREE.Mesh).isMesh && accept(o)) found.push(o);
      });
      return found;
    };
    const pick = (x: number, y: number) => {
      aim(x, y);
      const hit = raycaster.intersectObjects(
        meshes((o) => {
          for (let p: THREE.Object3D | null = o; p; p = p.parent)
            if (p.userData.sceneId || p.userData.instanceIds) return true;
          return false;
        }),
        false,
      )[0];
      return hit ? sceneIdOf(hit) : null;
    };
    const surfaceAt = (x: number, y: number): SurfaceHit | null => {
      const surfaces = meshes((o) => !!o.userData.surface);
      aim(x, y);
      const hit = raycaster.intersectObjects(surfaces, false)[0];
      if (!hit) return null;
      const normal = hitNormal(hit);
      // Average the orientation over a few pixels so piped texture and small
      // bumps do not tilt the decoration.
      for (const [dx, dy] of [
        [5, 0],
        [-5, 0],
        [0, 5],
        [0, -5],
      ]) {
        aim(x + dx, y + dy);
        const near = raycaster.intersectObject(hit.object, false)[0];
        if (near && Math.abs(near.distance - hit.distance) < 0.08) {
          const n = hitNormal(near);
          if (n.dot(normal) > 0.5) normal.add(n);
        }
      }
      return {
        surface: hit.object.userData.surface,
        point: hit.point,
        normal: normal.normalize(),
      };
    };
    const attachmentAt = (
      x: number,
      y: number,
      assetId: string,
    ): Attachment | null => {
      const hit = surfaceAt(x, y),
        { context } = latest.current;
      if (!hit) return null;
      const top = hit.normal.y > 0.5;
      if (!assetById(assetId)?.allowedPlacements.includes(top ? "top" : "side"))
        return null;
      if (hit.surface.type === "tier") {
        const layout = context.layouts.find(
          (l) => l.tier.id === hit.surface.id,
        );
        return layout
          ? attachmentFromPoint(hit.point.toArray(), layout, context.shape, top)
          : null;
      }
      const model = context.models.find((m) => m.id === hit.surface.id);
      return model
        ? {
            surface: "model",
            modelId: model.id,
            point: worldPointToModel(model, hit.point.toArray()),
            normal: worldDirectionToModel(model, hit.normal.toArray()),
            offset: 0,
          }
        : null;
    };
    const screenOf = (o: CakeObject) => {
      const placement = placementOf(o, latest.current.context);
      if (!placement) return null;
      const rect = canvas.getBoundingClientRect(),
        p = placement.position.clone().project(camera);
      return {
        x: rect.left + ((p.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - p.y) / 2) * rect.height,
      };
    };
    if (props.api)
      props.api.current = {
        scatter(assetId, count) {
          const rect = canvas.getBoundingClientRect(),
            reach = Math.min(rect.width, rect.height) * 0.2,
            found: Attachment[] = [];
          for (let i = 0; found.length < count && i < count * 6 + 24; i++) {
            const r = reach * Math.sqrt(i / (count * 2 + 4)),
              a = i * 2.39996,
              attachment = attachmentAt(
                rect.left + rect.width / 2 + Math.cos(a) * r,
                rect.top + rect.height * 0.5 + Math.sin(a) * r,
                assetId,
              );
            if (attachment) found.push(attachment);
          }
          return found;
        },
        beside(object) {
          const at = screenOf(object);
          for (const dx of [38, -38, 60, -60]) {
            const attachment =
              at && attachmentAt(at.x + dx, at.y, object.assetId);
            if (attachment) return attachment;
          }
          return null;
        },
      };

    let gesture: {
      startX: number;
      startY: number;
      pick: string | null;
      moved: boolean;
      gizmo: boolean;
      drag?: { object: CakeObject; dx: number; dy: number; last?: CakeObject };
    } | null = null;
    const orbit = () =>
      get().controls as unknown as { enabled: boolean } | null;
    const gizmo = () => latest.current.gizmo.current as Gizmo | null;
    const down = (e: PointerEvent) => {
      const { selection, objects, tool, onSelect } = latest.current;
      if (e.button !== 0 || e.target !== canvas || !onSelect) return;
      gesture = {
        startX: e.clientX,
        startY: e.clientY,
        pick: null,
        moved: false,
        gizmo: !!gizmo()?.axis,
      };
      if (gesture.gizmo) return;
      const id = (gesture.pick = pick(e.clientX, e.clientY)),
        object = objects.find((o) => o.id === id);
      if (!object || object.locked || tool !== "select" || e.shiftKey) return;
      // Grabbing a decoration selects it and moves it in the same gesture;
      // the camera stays put until the pointer is released.
      if (!selection.includes(object.id)) onSelect(object.id, false);
      const at = screenOf(object);
      gesture.drag = {
        object,
        dx: at ? e.clientX - at.x : 0,
        dy: at ? e.clientY - at.y : 0,
      };
      const controls = orbit();
      if (controls) controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
    };
    let hover = 0;
    const move = (e: PointerEvent) => {
      if (!gesture) {
        if (!latest.current.onSelect || e.target !== canvas || hover) return;
        hover = requestAnimationFrame(() => {
          hover = 0;
          const { objects, tool } = latest.current,
            id = gizmo()?.axis ? null : pick(e.clientX, e.clientY),
            object = objects.find((o) => o.id === id);
          canvas.style.cursor =
            object && !object.locked && tool === "select"
              ? "grab"
              : id
                ? "pointer"
                : "";
        });
        return;
      }
      if (
        Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > 4
      )
        gesture.moved = true;
      if (gizmo()?.dragging) gesture.gizmo = true;
      const drag = gesture.drag;
      if (!drag || !gesture.moved) return;
      canvas.style.cursor = "grabbing";
      const attachment = attachmentAt(
        e.clientX - drag.dx,
        e.clientY - drag.dy,
        drag.object.assetId,
      );
      if (!attachment) return;
      drag.last = { ...drag.object, attachment, nudge: undefined };
      latest.current.onPreview(drag.last);
    };
    const finish = (e: PointerEvent, cancelled: boolean) => {
      if (!gesture) return;
      const { drag, pick: id, moved } = gesture,
        usedGizmo = gesture.gizmo || gizmo()?.dragging;
      gesture = null;
      if (drag) {
        const controls = orbit();
        if (controls) controls.enabled = true;
        if (canvas.hasPointerCapture(e.pointerId))
          canvas.releasePointerCapture(e.pointerId);
        canvas.style.cursor = "grab";
        // One history entry per drag, written when the pointer is released.
        if (drag.last && !cancelled) latest.current.onObjectChange?.(drag.last);
        else if (!moved && !cancelled) latest.current.onSelect?.(id, false);
        latest.current.onPreview(null);
      } else if (!moved && !usedGizmo && !cancelled)
        latest.current.onSelect?.(id, e.shiftKey);
    };
    const up = (e: PointerEvent) => finish(e, false),
      cancel = (e: PointerEvent) => finish(e, true);
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("application/x-cake-asset")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };
    const drop = (e: DragEvent) => {
      const id = e.dataTransfer?.getData("application/x-cake-asset");
      if (!id) return;
      e.preventDefault();
      const attachment = attachmentAt(e.clientX, e.clientY, id);
      if (attachment) latest.current.onPlace?.(id, attachment);
    };
    // Capture phase: decide who owns the gesture before the orbit controls
    // (which listen on the same element) see the event.
    host.addEventListener("pointerdown", down, true);
    host.addEventListener("pointermove", move, true);
    host.addEventListener("pointerup", up, true);
    host.addEventListener("pointercancel", cancel, true);
    canvas.addEventListener("dragover", over);
    canvas.addEventListener("drop", drop);
    return () => {
      cancelAnimationFrame(hover);
      canvas.style.cursor = "";
      if (props.api) props.api.current = null;
      host.removeEventListener("pointerdown", down, true);
      host.removeEventListener("pointermove", move, true);
      host.removeEventListener("pointerup", up, true);
      host.removeEventListener("pointercancel", cancel, true);
      canvas.removeEventListener("dragover", over);
      canvas.removeEventListener("drop", drop);
    };
  }, [gl, camera, scene, get, props.api]);
  return null;
}
