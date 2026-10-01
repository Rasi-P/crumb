import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import type {
  OrbitControls as OrbitControlsImpl,
  TransformControls as TransformControlsImpl,
} from "three-stdlib";
import * as THREE from "three";
import type {
  Attachment,
  CakeConfig,
  CakeObject,
  Tier,
} from "../domain/models";
import {
  assetById,
  normalizeCake,
  tierLayout,
  UNIT,
  perimeterRadius,
  type TierLayout,
} from "../domain/cakeScene";
import { tierGeometry, dripGeometry } from "./scene/geometry";
import { FrostingMaterial, ObjectMaterial } from "./scene/materials";
import { Decoration, SmallDecorations } from "./scene/Decorations";
import { GeneratedModel } from "./scene/GeneratedModel";
import { Interaction, type SceneApi } from "./scene/Interaction";
import { SelectionToolbar } from "./scene/SelectionToolbar";
import type { SceneContext } from "./scene/placement";
import { Lettering } from "./scene/Lettering";
import { StudioPostprocessing } from "./scene/StudioPostprocessing";
import { ContactShadow } from "./scene/ContactShadow";
import { Cake2D } from "./Cake2D";
export type { SceneApi };
type Props = {
  config: CakeConfig;
  selection?: string[];
  // null clears the selection; additive toggles membership (shift-click).
  onSelect?: (id: string | null, additive: boolean) => void;
  view?: string;
  zoom?: number;
  reset?: number;
  autoRotate?: boolean;
  tool?: string;
  api?: RefObject<SceneApi | null>;
  onObjectChange?: (o: CakeObject) => void;
  onPlace?: (assetId: string, attachment: Attachment) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onModelError?: (message: string) => void;
};
// What the camera and shadows need to cover: visible tiers, the board, and
// any generated model standing in for them.
function sceneExtent(config: CakeConfig) {
  const all = tierLayout(config),
    models = (config.generatedModels || []).filter((m) => !m.hidden),
    visible = all.filter((l) => !l.tier.hidden),
    layouts = visible.length || models.length ? visible : all;
  return {
    height: Math.max(
      0.4,
      ...layouts.map((l) => l.top + (config.topper ? 0.75 : 0.28)),
      ...models.map(
        (m) => (m.position[1] + m.height * m.diameter) * UNIT + 0.2,
      ),
    ),
    radius:
      Math.max(
        config.board!.hidden ? 0 : (config.board!.diameter * UNIT) / 2,
        ...layouts.map((l) => l.radius + Math.hypot(l.x, l.z)),
        ...models.map(
          (m) =>
            (m.diameter * 0.62 + Math.hypot(m.position[0], m.position[2])) *
            UNIT,
        ),
      ) + 0.45,
  };
}
function TierMesh({
  layout,
  shape,
  number,
}: {
  number: string;
  layout: TierLayout;
  shape: CakeConfig["shape"];
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
    <group position={[x, bottom, z]} userData={{ sceneId: tier.id }}>
      <mesh
        geometry={geometry}
        userData={{ surface: { type: "tier", id: tier.id } }}
        castShadow
        receiveShadow
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
function CakeScene(props: Props & { onReady: () => void }) {
  const { config, onSelect } = props,
    selection = props.selection ?? [],
    tool = props.tool ?? "select",
    layouts = useMemo(() => tierLayout(config), [config]),
    context = useMemo<SceneContext>(
      () => ({
        layouts,
        models: config.generatedModels || [],
        shape: config.shape,
      }),
      [layouts, config.generatedModels, config.shape],
    );
  // Live positions while a drag is in progress; committed to history once.
  const [dragged, setDragged] = useState<CakeObject | null>(null),
    [adjusted, setAdjusted] = useState<CakeObject | null>(null),
    gizmo = useRef<TransformControlsImpl>(null),
    preview = dragged ?? adjusted;
  const objects = (config.objects || [])
    .map((o) => (preview?.id === o.id ? preview : o))
    .filter((o) => !o.hidden);
  const small = objects.filter(
    (o) =>
      !selection.includes(o.id) &&
      ["pearl", "sprinkle", "foil"].includes(assetById(o.assetId)?.kind || ""),
  );
  const other = objects.filter((o) => !small.includes(o));
  const single =
    selection.length === 1 ? objects.find((o) => o.id === selection[0]) : null;
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
      {!config.board!.hidden && (
        <mesh
          geometry={boardGeometry}
          userData={{ sceneId: "board" }}
          castShadow
          receiveShadow
        >
          <ObjectMaterial
            object={{
              color: config.boardColor,
              material: config.board!.material,
            }}
          />
        </mesh>
      )}
      {layouts.map((l) => (
        <TierMesh
          key={l.tier.id}
          layout={l}
          shape={config.shape}
          number={config.number}
        />
      ))}
      {(config.generatedModels || []).map((m) => (
        <GeneratedModel
          key={m.id}
          model={m}
          onReady={props.onReady}
          onError={props.onModelError}
        />
      ))}
      <SmallDecorations objects={small} context={context} />
      {other.map((o) => (
        <Decoration
          key={o.id}
          object={o}
          context={context}
          selected={single?.id === o.id}
          onChange={props.onObjectChange}
          tool={tool}
          gizmo={gizmo}
        />
      ))}
      <Lettering config={config} kind="text" layout={layouts[0]} />
      <Lettering
        config={config}
        kind="topper"
        layout={layouts[layouts.length - 1]}
      />
      {single &&
        !single.locked &&
        !dragged &&
        tool === "select" &&
        props.onObjectChange && (
          <SelectionToolbar
            object={single}
            context={context}
            onPreview={setAdjusted}
            onChange={props.onObjectChange}
            onDuplicate={props.onDuplicate}
            onDelete={props.onDelete}
          />
        )}
      {onSelect && (
        <Interaction
          objects={config.objects || []}
          context={context}
          selection={selection}
          tool={tool}
          gizmo={gizmo}
          api={props.api}
          onSelect={onSelect}
          onObjectChange={props.onObjectChange}
          onPlace={props.onPlace}
          onPreview={setDragged}
        />
      )}
    </>
  );
}
function CameraControls({
  config,
  view = "Perspective",
  zoom = 0,
  reset = 0,
  autoRotate = false,
}: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  const { height, radius } = sceneExtent(config);
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
function StudioLighting({
  config,
  revision,
}: {
  config: CakeConfig;
  revision: number;
}) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = config.background!.exposure * 0.88;
  }, [gl, config.background!.exposure]);
  const { height } = sceneExtent(config);
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
      <ContactShadow
        revision={`${JSON.stringify(config)}:${revision}`}
        height={height}
      />
    </>
  );
}
export default function Cake3D(props: Props) {
  const config = useMemo(() => normalizeCake(props.config), [props.config]);
  // Bumped when a model finishes loading so contact shading includes it.
  const [loaded, setLoaded] = useState(0),
    onReady = useCallback(() => setLoaded((n) => n + 1), []);
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
          <StudioLighting config={config} revision={loaded} />
          <CakeScene {...props} config={config} onReady={onReady} />
          <CameraControls {...props} config={config} />
          <StudioPostprocessing selection={props.selection} />
        </Canvas>
      </RenderBoundary>
    </div>
  );
}
