import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useGLTF, TransformControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { CakeConfig, CakeObject } from "../../domain/models";
import {
  assetById,
  attachmentPosition,
  seedValue,
  perimeterRadius,
  type TierLayout,
} from "../../domain/cakeScene";
import { flowerGeometry, leafGeometry, foilGeometry } from "./geometry";
import { ObjectMaterial, materialPresets, petalTexture } from "./materials";
const up = new THREE.Vector3(0, 1, 0);
export function attachmentQuaternion(
  o: CakeObject,
  shape: CakeConfig["shape"] = "Round",
) {
  const a = o.attachment.angle,
    epsilon = 0.0001,
    r0 = perimeterRadius(shape, 1, a - epsilon),
    r1 = perimeterRadius(shape, 1, a + epsilon);
  const dx = Math.cos(a + epsilon) * r1 - Math.cos(a - epsilon) * r0,
    dz = Math.sin(a + epsilon) * r1 - Math.sin(a - epsilon) * r0;
  return new THREE.Quaternion().setFromUnitVectors(
    up,
    o.attachment.surface === "top"
      ? up
      : new THREE.Vector3(dz, 0, -dx).normalize(),
  );
}

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
  useEffect(
    () => () =>
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name === "Petals")
          child.material.dispose();
      }),
    [clone],
  );
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
  layout,
  shape,
  selected,
  onSelect,
  onChange,
  tool,
}: {
  object: CakeObject;
  layout: TierLayout;
  shape: CakeConfig["shape"];
  selected: boolean;
  onSelect?: (id: string) => void;
  onChange?: (o: CakeObject) => void;
  tool?: string;
}) {
  const transform = useRef<THREE.Group>(null);
  const attachedRotation = attachmentQuaternion(
    object,
    layout.tier.shape ?? shape,
  );
  const p = attachmentPosition(object.attachment, layout, shape);
  const body = (
    <group
      ref={transform}
      rotation={object.rotation}
      scale={object.scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(object.id);
      }}
    >
      <DecorationAsset object={object} />
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
          <ringGeometry args={[0.36, 0.369, 64]} />
          <meshBasicMaterial
            color="#9673a3"
            side={THREE.DoubleSide}
            depthTest={false}
            transparent
            opacity={0.65}
          />
        </mesh>
      )}
    </group>
  );
  return (
    <group position={p} quaternion={attachedRotation}>
      {selected && !object.locked && (tool === "rotate" || tool === "scale") ? (
        <TransformControls
          mode={tool}
          size={0.7}
          space="local"
          onMouseUp={() => {
            const g = transform.current;
            if (g)
              onChange?.({
                ...object,
                rotation: [g.rotation.x, g.rotation.y, g.rotation.z],
                scale: Math.max(0.1, Math.min(4, g.scale.x)),
              });
          }}
          showY={tool === "rotate"}
          showZ={tool === "rotate"}
        >
          {body}
        </TransformControls>
      ) : (
        body
      )}
    </group>
  );
}
// Each instance retains its own ID, transform, price, and selection. Batching only affects rendering.
export function SmallDecorations({
  objects,
  layouts,
  shape,
  selected,
  onSelect,
}: {
  objects: CakeObject[];
  layouts: TierLayout[];
  shape: CakeConfig["shape"];
  selected?: string;
  onSelect?: (id: string) => void;
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
          layouts={layouts}
          shape={shape}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
function InstanceBatch({
  objects,
  layouts,
  shape,
  selected,
  onSelect,
}: {
  objects: CakeObject[];
  layouts: TierLayout[];
  shape: CakeConfig["shape"];
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const kind = assetById(objects[0].assetId)?.kind;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    objects.forEach((o, i) => {
      const layout = layouts.find((l) => l.tier.id === o.attachment.tierId)!;
      dummy.position.set(...attachmentPosition(o.attachment, layout, shape));
      dummy.quaternion.copy(
        attachmentQuaternion(o, layout.tier.shape ?? shape),
      );
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
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(
        i,
        new THREE.Color(o.id === selected ? "#b99ac9" : o.color),
      );
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [objects, layouts, shape, kind, selected]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, objects.length]}
      castShadow
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onSelect?.(objects[e.instanceId].id);
      }}
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
