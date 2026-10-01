import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type {
  Attachment,
  CakeConfig,
  CakeObject,
  Tier,
} from "../domain/models";
import {
  assetById,
  attachmentFromPoint,
  normalizeCake,
  tierLayout,
  UNIT,
  perimeterRadius,
  type TierLayout,
} from "../domain/cakeScene";
import { tierGeometry, dripGeometry } from "./scene/geometry";
import { FrostingMaterial, ObjectMaterial } from "./scene/materials";
import { Decoration, SmallDecorations } from "./scene/Decorations";
import { Lettering } from "./scene/Lettering";
import { StudioPostprocessing } from "./scene/StudioPostprocessing";
import { ContactShadow } from "./scene/ContactShadow";
import { Cake2D } from "./Cake2D";
type Props = {
  config: CakeConfig;
  selected?: string;
  onSelect?: (id: string) => void;
  view?: string;
  zoom?: number;
  reset?: number;
  autoRotate?: boolean;
  tool?: string;
  onObjectChange?: (o: CakeObject) => void;
  onPlace?: (assetId: string, attachment: Attachment) => void;
};
function TierMesh({
  layout,
  shape,
  selected,
  onSelect,
  number,
}: {
  number: string;
  layout: TierLayout;
  shape: CakeConfig["shape"];
  selected: boolean;
  onSelect?: Props["onSelect"];
}) {
  const { tier, radius, height, bottom, x, z } = layout;
  const geometry = useMemo(
    () => tierGeometry(tier, tier.shape ?? shape, radius, height, number),
    [
      tier.shape,
      tier.finish,
      tier.imperfection,
      tier.frostingThickness,
      shape,
      number,
      radius,
      height,
    ],
  );
  const drip = useMemo(
    () =>
      tier.finish === "Drip"
        ? dripGeometry(radius, height, tier.shape ?? shape)
        : null,
    [tier.finish, tier.shape, radius, height, shape],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => drip?.dispose(), [drip]);
  if (tier.hidden) return null;
  return (
    <group position={[x, bottom, z]}>
      <mesh
        geometry={geometry}
        userData={{ tierId: tier.id }}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(tier.id);
        }}
      >
        <FrostingMaterial tier={tier} />
      </mesh>
      {drip && (
        <mesh geometry={drip} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={tier.frosting === "Ganache" ? "#3c2118" : "#fff0d4"}
            roughness={0.29}
            clearcoat={0.18}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {["Vintage", "Piped", "Ruffled"].includes(tier.finish) && (
        <Piping
          radius={radius}
          height={height}
          tier={tier}
          shape={tier.shape ?? shape}
        />
      )}{" "}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <ringGeometry args={[radius + 0.025, radius + 0.032, 128]} />
          <meshBasicMaterial
            color="#947c9b"
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
function Piping({
  radius,
  height,
  tier,
  shape,
}: {
  radius: number;
  height: number;
  tier: Tier;
  shape: CakeConfig["shape"];
}) {
  const geometry = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 512; i++) {
      const a = (i / 512) * Math.PI * 2;
      const r =
        perimeterRadius(shape, radius, a) + 0.005 + Math.sin(a * 55) * 0.013;
      points.push(
        new THREE.Vector3(
          Math.cos(a) * r,
          Math.cos(a * 55) * 0.015,
          Math.sin(a) * r,
        ),
      );
    }
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      512,
      0.025,
      6,
      false,
    );
  }, [radius, shape]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <>
      {[0.04, height - 0.01].map((y) => (
        <mesh
          key={y}
          position={[0, y, 0]}
          geometry={geometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={tier.color} roughness={0.8} />
        </mesh>
      ))}
    </>
  );
}
function SurfacePlacement({
  config,
  selected,
  tool,
  onObjectChange,
  onPlace,
  onPreview,
}: {
  config: CakeConfig;
  selected?: string;
  tool?: string;
  onObjectChange?: Props["onObjectChange"];
  onPlace?: Props["onPlace"];
  onPreview: (o: CakeObject | null) => void;
}) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const canvas = gl.domElement,
      ray = new THREE.Raycaster();
    let drag = false,
      last: CakeObject | null = null;
    const layouts = tierLayout(config);
    const hit = (e: MouseEvent | DragEvent) => {
      const rect = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      // Only tier surfaces can receive decorations. Avoid intersecting every
      // petal and extruded letter on each pointer movement.
      const surfaces: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        if (o instanceof THREE.Mesh && o.userData.tierId) surfaces.push(o);
      });
      const hit = ray.intersectObjects(surfaces, false)[0];
      if (!hit) return null;
      const l = layouts.find((l) => l.tier.id === hit.object.userData.tierId)!;
      return attachmentFromPoint(
        hit.point.toArray(),
        l,
        config.shape,
        (hit.face?.normal.y ?? 0) > 0.5,
      );
    };
    const selectedObject = config.objects?.find(
      (o) => o.id === selected && !o.locked && !o.hidden,
    );
    const move = (e: PointerEvent) => {
      if (!drag || !selectedObject) return;
      const attachment = hit(e);
      if (attachment) {
        const a = assetById(selectedObject.assetId);
        if (!a?.allowedPlacements.includes(attachment.surface)) return;
        last = { ...selectedObject, attachment };
        onPreview(last);
      }
    };
    const down = (e: PointerEvent) => {
      if (tool !== "move" || !selectedObject || e.button !== 0) return;
      drag = true;
      canvas.setPointerCapture(e.pointerId);
      move(e);
    };
    const up = (e: PointerEvent) => {
      if (!drag) return;
      drag = false;
      if (last) onObjectChange?.(last);
      last = null;
      onPreview(null);
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
    };
    const cancel = () => {
      drag = false;
      last = null;
      onPreview(null);
    };
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
      const attachment = hit(e),
        a = assetById(id);
      if (attachment && a?.allowedPlacements.includes(attachment.surface))
        onPlace?.(id, attachment);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("dragover", over);
    canvas.addEventListener("drop", drop);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("dragover", over);
      canvas.removeEventListener("drop", drop);
    };
  }, [
    config,
    selected,
    tool,
    gl,
    camera,
    scene,
    onObjectChange,
    onPlace,
    onPreview,
  ]);
  return null;
}
function CakeScene(props: Props) {
  const { config, selected, onSelect } = props,
    layouts = useMemo(() => tierLayout(config), [config]);
  const [preview, setPreview] = useState<CakeObject | null>(null);
  const objects = (config.objects || [])
    .map((o) => (preview?.id === o.id ? preview : o))
    .filter(
      (o) =>
        !o.hidden &&
        !layouts.find((l) => l.tier.id === o.attachment.tierId)?.tier.hidden,
    );
  const small = objects.filter(
    (o) =>
      o.id !== selected &&
      ["pearl", "sprinkle", "foil"].includes(assetById(o.assetId)?.kind || ""),
  );
  const other = objects.filter((o) => !small.includes(o));
  const boardRadius =
    Math.max(
      config.board!.diameter / 2,
      ...layouts.map(
        (l) => l.radius / UNIT + Math.hypot(l.x, l.z) / UNIT + 0.4,
      ),
    ) * UNIT;
  const boardGeometry = useMemo(
    () =>
      tierGeometry(
        {
          diameter: 8,
          height: 2,
          color: "#fff",
          frosting: "Fondant",
          finish: "Smooth",
          decorations: [],
          id: "board",
          imperfection: 0.08,
          frostingThickness: 0.06,
        },
        "Round",
        boardRadius,
        config.board!.thickness * UNIT,
      ),
    [boardRadius, config.board!.thickness],
  );
  useEffect(() => () => boardGeometry.dispose(), [boardGeometry]);
  return (
    <>
      <mesh
        geometry={boardGeometry}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.("board");
        }}
      >
        <ObjectMaterial
          object={{
            color: config.boardColor,
            material: config.board!.material,
          }}
        />
      </mesh>
      {layouts.map((l) => (
        <TierMesh
          key={l.tier.id}
          layout={l}
          shape={config.shape}
          number={config.number}
          selected={selected === l.tier.id}
          onSelect={props.tool === "move" ? undefined : onSelect}
        />
      ))}
      <SmallDecorations
        objects={small}
        layouts={layouts}
        shape={config.shape}
        selected={selected}
        onSelect={onSelect}
      />
      {other.map((o) => (
        <Decoration
          key={o.id}
          object={o}
          layout={layouts.find((l) => l.tier.id === o.attachment.tierId)!}
          shape={config.shape}
          selected={o.id === selected}
          onSelect={onSelect}
          onChange={props.onObjectChange}
          tool={props.tool}
        />
      ))}
      <Lettering
        config={config}
        kind="text"
        layout={layouts[0]}
        onSelect={onSelect}
      />
      <Lettering
        config={config}
        kind="topper"
        layout={layouts[layouts.length - 1]}
        onSelect={onSelect}
      />
      <SurfacePlacement {...props} onPreview={setPreview} />
    </>
  );
}
function CameraControls({
  config,
  view = "Perspective",
  zoom = 0,
  reset = 0,
  autoRotate = false,
  tool,
}: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  const layouts = tierLayout(config),
    height = layouts.at(-1)!.top + (config.topper ? 0.75 : 0.28);
  const radius =
    Math.max(
      (config.board!.diameter * UNIT) / 2,
      ...layouts.map((l) => l.radius + Math.hypot(l.x, l.z)),
    ) + 0.45;
  const layoutKey = layouts
    .map((l) => `${l.radius}:${l.x}:${l.z}:${l.top}`)
    .join("|");
  useEffect(() => {
    const target = new THREE.Vector3(0, height * 0.48, 0),
      aspect = size.width / Math.max(1, size.height),
      fov = (32 * Math.PI) / 180;
    const distance =
      Math.max(
        (height * 0.66) / Math.tan(fov / 2),
        radius / (Math.tan(fov / 2) * aspect),
      ) * 1.3;
    const dir =
      view === "Front"
        ? new THREE.Vector3(0, 0.03, 1)
        : view === "Side"
          ? new THREE.Vector3(1, 0.03, 0)
          : view === "Top"
            ? new THREE.Vector3(0, 1, 0.001)
            : new THREE.Vector3(0.4, 0.29, 1).normalize();
    camera.position
      .copy(target)
      .addScaledVector(dir, distance * (view === "Close-up" ? 0.7 : 1));
    camera.zoom = Math.max(0.6, 1 + zoom * 0.13);
    camera.updateProjectionMatrix();
    controls.current?.target.copy(target);
    controls.current?.update();
    invalidate();
  }, [
    view,
    zoom,
    reset,
    layoutKey,
    height,
    radius,
    camera,
    size.width,
    size.height,
    invalidate,
  ]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={tool !== "move"}
      enablePan
      enableDamping
      dampingFactor={0.08}
      minDistance={Math.max(radius * 1.4, height * 0.65)}
      maxDistance={40}
      maxPolarAngle={Math.PI * 0.49}
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
    />
  );
}
class RenderBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function StudioLighting({ config }: { config: CakeConfig }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = config.background!.exposure * 0.88;
  }, [gl, config.background!.exposure]);
  const height = tierLayout(config).at(-1)!.top;
  return (
    <>
      <color attach="background" args={[config.background!.color]} />
      <hemisphereLight args={["#fff4e5", "#9b8a80", 0.12]} />
      <directionalLight
        position={[-3.5, 5, 3]}
        intensity={2.0}
        color="#fff5e8"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={height + 3}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-normalBias={0.0015}
        shadow-bias={-0.0001}
        shadow-radius={14}
        shadow-blurSamples={8}
        shadow-intensity={0.7}
      />
      <directionalLight
        position={[4, 4, -3]}
        intensity={0.35}
        color="#f5f7ff"
      />
      <Suspense fallback={null}>
        <Environment
          files="/assets/materials/studio-small-09.hdr"
          environmentIntensity={0.65}
          environmentRotation={[0, 2.2, 0]}
        />
      </Suspense>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.008, 0]}
        userData={{ studioFloor: true }}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color={config.background!.color}
          roughness={0.94}
        />
      </mesh>
      <ContactShadow revision={JSON.stringify(config)} height={height} />
    </>
  );
}
export default function Cake3D(props: Props) {
  const config = useMemo(() => normalizeCake(props.config), [props.config]);
  const fallback = (
    <div className="webgl-fallback">
      <p>3D preview is unavailable. You can continue editing in 2D Design.</p>
      <Cake2D config={config} />
    </div>
  );
  return (
    <div className="cake-3d" aria-label="Interactive 3D cake preview">
      <RenderBoundary fallback={fallback}>
        <Canvas
          frameloop={props.autoRotate ? "always" : "demand"}
          shadows={{ type: THREE.VSMShadowMap }}
          dpr={[1, 2]}
          camera={{ position: [4, 3, 8], fov: 32, near: 0.05, far: 100 }}
          gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
          fallback={fallback}
        >
          <StudioLighting config={config} />
          <CakeScene {...props} config={config} />
          <CameraControls {...props} config={config} />
          <StudioPostprocessing />
        </Canvas>
      </RenderBoundary>
    </div>
  );
}
