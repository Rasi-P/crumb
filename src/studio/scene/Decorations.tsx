import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { useGLTF, TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { TransformControls as TransformControlsImpl } from "three-stdlib";
import type { CakeObject } from "../../domain/models";
import { assetById, seedValue, UNIT } from "../../domain/cakeScene";
import { flowerGeometry, leafGeometry, foilGeometry } from "./geometry";
import { ObjectMaterial, materialPresets, petalTexture } from "./materials";
import { placementOf, type SceneContext } from "./placement";

class AssetBoundary extends Component<
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
function ProceduralFlower({ object }: { object: CakeObject }) {
  const geometry = useMemo(
    () => flowerGeometry(object.seed % 3),
    [object.seed],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        {...materialPresets.Petal}
        color={object.color}
        vertexColors
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
function FlowerAsset({ object, url }: { object: CakeObject; url: string }) {
  const { scene } = useGLTF(url);
  const bump = useMemo(petalTexture, []);
  useEffect(() => () => bump.dispose(), [bump]);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.name === "Petals") {
          child.material = child.material.clone();
          child.material.color.set(object.color);
          child.material.color.multiplyScalar(
            0.97 + seedValue(object.seed) * 0.05,
          );
          Object.assign(child.material, materialPresets[object.material]);
          child.material.bumpMap = bump;
          child.material.bumpScale = 0.009;
          child.material.envMapIntensity = 0.85;
        }
      }
    });
    return c;
  }, [scene, object.color, object.seed, object.material, bump]);
  // The canvas renders on demand; show the model as soon as it has loaded
  // instead of leaving the placeholder up until the next interaction.
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    return () =>
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name === "Petals")
          child.material.dispose();
      });
  }, [clone, invalidate]);
  return <primitive object={clone} dispose={null} />;
}
function Leaf({ object }: { object: CakeObject }) {
  const g = useMemo(leafGeometry, []);
  useEffect(() => () => g.dispose(), [g]);
  return (
    <mesh geometry={g} castShadow receiveShadow>
      <ObjectMaterial object={object} />
    </mesh>
  );
}
function Bow({ object }: { object: CakeObject }) {
  const geometries = useMemo(
    () =>
      [-1, 1].map((sign) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.04, 0),
          new THREE.Vector3(sign * 0.18, 0.09, -0.1),
          new THREE.Vector3(sign * 0.32, 0.04, 0),
          new THREE.Vector3(sign * 0.18, 0.015, 0.1),
          new THREE.Vector3(0, 0.04, 0),
        ]);
        return new THREE.TubeGeometry(curve, 36, 0.035, 8, false);
      }),
    [],
  );
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <ObjectMaterial object={object} />
        </mesh>
      ))}
    </group>
  );
}
function Foil() {
  const geometry = useMemo(foilGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}
function DecorationAsset({ object }: { object: CakeObject }) {
  const asset = assetById(object.assetId),
    kind = asset?.kind;
  if (asset?.modelUrl)
    return (
      <AssetBoundary fallback={<ProceduralFlower object={object} />}>
        <Suspense fallback={<ProceduralFlower object={object} />}>
          <FlowerAsset object={object} url={asset.modelUrl} />
        </Suspense>
      </AssetBoundary>
    );
  if (kind === "pearl" || kind === "sprinkle" || kind === "foil")
    return (
      <mesh
        castShadow
        receiveShadow
        position={[0, kind === "pearl" ? 0.025 : 0.006, 0]}
        scale={
          kind === "foil"
            ? [
                0.5 + seedValue(object.seed),
                1,
                0.5 + seedValue(object.seed + 1),
              ]
            : 1
        }
      >
        {kind === "sprinkle" ? (
          <capsuleGeometry args={[0.008, 0.034, 3, 5]} />
        ) : kind === "foil" ? (
          <Foil />
        ) : (
          <sphereGeometry args={[0.031, 16, 12]} />
        )}
        {kind === "foil" ? (
          <meshPhysicalMaterial
            {...materialPresets[object.material]}
            color={object.color}
            roughness={0.42}
            envMapIntensity={2}
            side={THREE.DoubleSide}
          />
        ) : (
          <ObjectMaterial object={object} />
        )}
      </mesh>
    );
  if (kind === "leaf") return <Leaf object={object} />;
  if (kind === "bow") return <Bow object={object} />;
  if (kind === "macaron")
    return (
      <group position={[0, 0.08, 0]}>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[0, s * 0.048, 0]}
            scale={[1, 0.42, 1]}
            castShadow
          >
            <sphereGeometry args={[0.19, 32, 20]} />
            <ObjectMaterial object={object} />
          </mesh>
        ))}
        <mesh castShadow>
          <cylinderGeometry args={[0.174, 0.174, 0.027, 40]} />
          <meshStandardMaterial color="#fff2d9" roughness={0.82} />
        </mesh>
      </group>
    );
  if (kind === "chocolate")
    return (
      <mesh position={[0, 0.17, 0]} rotation={[0.2, 0.4, 0.15]} castShadow>
        <boxGeometry args={[0.19, 0.39, 0.025]} />
        <ObjectMaterial object={object} />
      </mesh>
    );
  if (kind === "berry")
    return (
      <group>
        <mesh position={[0, 0.14, 0]} scale={[1, 1.35, 1]} castShadow>
          <sphereGeometry args={[0.13, 32, 24]} />
          <ObjectMaterial object={object} />
        </mesh>
        {Array.from({ length: 24 }, (_, i) => {
          const a = i * 2.399,
            h = 0.04 + seedValue(i) * 0.22,
            r =
              0.13 *
              Math.sqrt(Math.max(0, 1 - Math.pow((h - 0.14) / 0.175, 2)));
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * r, h, Math.sin(a) * r]}
              scale={[0.005, 0.01, 0.005]}
            >
              <sphereGeometry args={[1, 6, 4]} />
              <meshStandardMaterial color="#e8bf75" />
            </mesh>
          );
        })}
        <group position={[0, 0.29, 0]} scale={0.3}>
          <Leaf object={{ ...object, color: "#4f713b" }} />
        </group>
      </group>
    );
  if (kind === "bear")
    return (
      <group>
        <mesh position={[0, 0.13, 0]} scale={[0.9, 1.1, 0.75]} castShadow>
          <sphereGeometry args={[0.17, 24, 16]} />
          <ObjectMaterial object={object} />
        </mesh>
        <mesh position={[0, 0.38, 0]} castShadow>
          <sphereGeometry args={[0.16, 24, 16]} />
          <ObjectMaterial object={object} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.12, 0.5, 0]}>
              <sphereGeometry args={[0.065, 16, 12]} />
              <ObjectMaterial object={object} />
            </mesh>
            <mesh position={[s * 0.058, 0.4, 0.14]}>
              <sphereGeometry args={[0.013, 12, 8]} />
              <meshStandardMaterial color="#31231c" />
            </mesh>
          </group>
        ))}
      </group>
    );
  return (
    <mesh castShadow position={[0, 0.04, 0]}>
      <sphereGeometry args={[0.04, 16, 12]} />
      <ObjectMaterial object={object} />
    </mesh>
  );
}
export function Decoration({
  object,
  context,
  selected,
  onChange,
  tool,
  gizmo,
}: {
  object: CakeObject;
  context: SceneContext;
  selected: boolean;
  onChange?: (o: CakeObject) => void;
  tool?: string;
  gizmo?: Ref<TransformControlsImpl>;
}) {
  // State rather than refs: the gizmo attaches once these nodes exist.
  const [anchor, setAnchor] = useState<THREE.Group | null>(null),
    [body, setBody] = useState<THREE.Group | null>(null);
  const placement = placementOf(object, context);
  if (!placement) return null;
  const mode =
    selected && !object.locked && onChange
      ? tool === "rotate"
        ? "rotate"
        : tool === "scale"
          ? "scale"
          : tool === "free"
            ? "translate"
            : null
      : null;
  return (
    <>
      <group
        ref={setAnchor}
        position={placement.position}
        quaternion={placement.quaternion}
      >
        <group
          ref={setBody}
          rotation={object.rotation}
          scale={object.scale}
          userData={{ sceneId: object.id }}
        >
          <DecorationAsset object={object} />
        </group>
      </group>
      {mode && anchor && body && (
        <TransformControls
          ref={gizmo}
          object={mode === "translate" ? anchor : body}
          mode={mode}
          size={0.7}
          space={mode === "translate" ? "world" : "local"}
          // Size stays uniform; one handle is enough.
          showY={mode !== "scale"}
          showZ={mode !== "scale"}
          onMouseUp={() => {
            if (mode === "translate") {
              // Free Transform lifts the object off its surface point; the
              // attachment is kept so it still follows the cake.
              const offset = anchor.position
                .clone()
                .sub(placement.position)
                .divideScalar(UNIT)
                .add(new THREE.Vector3(...(object.nudge ?? [0, 0, 0])));
              onChange?.({
                ...object,
                nudge: [
                  Math.max(-30, Math.min(30, offset.x)),
                  Math.max(-30, Math.min(30, offset.y)),
                  Math.max(-30, Math.min(30, offset.z)),
                ],
              });
            } else
              onChange?.({
                ...object,
                rotation: [body.rotation.x, body.rotation.y, body.rotation.z],
                scale: Math.max(0.1, Math.min(4, body.scale.x)),
              });
          }}
        />
      )}
    </>
  );
}
// Each instance retains its own ID, transform, price, and selection. Batching only affects rendering.
export function SmallDecorations({
  objects,
  context,
}: {
  objects: CakeObject[];
  context: SceneContext;
}) {
  const groups = useMemo(() => {
    const result = new Map<string, CakeObject[]>();
    objects.forEach((o) => {
      const key = `${assetById(o.assetId)?.kind}:${o.material}`;
      result.set(key, [...(result.get(key) || []), o]);
    });
    return [...result.values()];
  }, [objects]);
  return (
    <>
      {groups.map((group) => (
        <InstanceBatch
          key={`${group[0].assetId}-${group[0].material}`}
          objects={group}
          context={context}
        />
      ))}
    </>
  );
}
function InstanceBatch({
  objects,
  context,
}: {
  objects: CakeObject[];
  context: SceneContext;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const kind = assetById(objects[0].assetId)?.kind;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    objects.forEach((o, i) => {
      const placement = placementOf(o, context);
      if (placement) {
        dummy.position.copy(placement.position);
        dummy.quaternion.copy(placement.quaternion);
        dummy.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation)),
        );
        dummy.scale.setScalar(o.scale);
        dummy.translateY(kind === "pearl" ? 0.025 : 0.006);
        if (kind === "foil")
          dummy.scale.multiply(
            new THREE.Vector3(
              0.5 + seedValue(o.seed),
              1,
              0.5 + seedValue(o.seed + 1),
            ),
          );
      } else dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(o.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [objects, context, kind]);
  return (
    <instancedMesh
      // A fixed-size instance buffer cannot grow; remount when the count does.
      key={objects.length}
      ref={ref}
      args={[undefined, undefined, objects.length]}
      castShadow
      receiveShadow
      userData={{ instanceIds: objects.map((o) => o.id) }}
    >
      {kind === "sprinkle" ? (
        <capsuleGeometry args={[0.008, 0.034, 3, 5]} />
      ) : kind === "foil" ? (
        <Foil />
      ) : (
        <sphereGeometry args={[0.031, 16, 12]} />
      )}
      <meshPhysicalMaterial
        {...materialPresets[objects[0].material]}
        color="white"
        side={THREE.DoubleSide}
        envMapIntensity={kind === "foil" ? 2 : 1}
        roughness={
          kind === "foil"
            ? 0.42
            : materialPresets[objects[0].material].roughness
        }
      />
    </instancedMesh>
  );
}
