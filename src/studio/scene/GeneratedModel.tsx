import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { acceleratedRaycast } from "three-mesh-bvh";
import type { GeneratedModel as GeneratedModelRecord } from "../../domain/models";
import { UNIT } from "../../domain/cakeScene";
import { prepareModel, type PreparedModel } from "./modelAnalysis";

// Draco-compressed models decode with the copy bundled under /assets/draco.
useGLTF.setDecoderPath("/assets/draco/");

const prepared = new WeakMap<THREE.Object3D, PreparedModel>();
export function preparedModel(scene: THREE.Object3D) {
  let model = prepared.get(scene);
  if (!model) prepared.set(scene, (model = prepareModel(scene)));
  return model;
}

class ModelBoundary extends Component<
  { children: ReactNode; onError?: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ModelMeshes({
  model,
  onReady,
}: {
  model: GeneratedModelRecord;
  onReady?: () => void;
}) {
  const { scene } = useGLTF(model.url),
    { gl, invalidate } = useThree(),
    { parts } = useMemo(() => preparedModel(scene), [scene]);
  useEffect(() => {
    // The provider's PBR materials are used as delivered; this only improves
    // texture filtering at glancing angles.
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    for (const part of parts)
      for (const mesh of part.meshes)
        for (const material of [mesh.material].flat())
          for (const value of Object.values(material))
            if (
              (value as THREE.Texture | null)?.isTexture &&
              (value as THREE.Texture).anisotropy < anisotropy
            ) {
              (value as THREE.Texture).anisotropy = anisotropy;
              (value as THREE.Texture).needsUpdate = true;
            }
    invalidate();
    onReady?.();
  }, [parts, gl, invalidate, onReady]);
  const single = parts.length === 1;
  return (
    <group
      position={[
        model.position[0] * UNIT,
        model.position[1] * UNIT,
        model.position[2] * UNIT,
      ]}
      rotation-y={model.rotation}
      scale={model.diameter * UNIT}
    >
      {parts
        .filter((p) => !model.parts?.find((o) => o.key === p.key)?.hidden)
        .flatMap((part) =>
          part.meshes.map((mesh, i) => (
            <mesh
              key={`${part.key}-${i}`}
              geometry={mesh.geometry}
              material={mesh.material}
              matrix={mesh.matrix}
              matrixAutoUpdate={false}
              raycast={acceleratedRaycast}
              castShadow
              receiveShadow
              dispose={null}
              userData={{
                sceneId: single ? model.id : `${model.id}/${part.key}`,
                surface: { type: "model", id: model.id },
              }}
            />
          )),
        )}
    </group>
  );
}

// The generated mesh is the visual source of truth for the cake. Editable
// decorations attach to its surface; it is never replaced by primitives.
export function GeneratedModel({
  model,
  onReady,
  onError,
}: {
  model: GeneratedModelRecord;
  onReady?: () => void;
  onError?: (message: string) => void;
}) {
  if (model.hidden) return null;
  return (
    <ModelBoundary key={model.url} onError={onError}>
      <Suspense fallback={null}>
        <ModelMeshes model={model} onReady={onReady} />
      </Suspense>
    </ModelBoundary>
  );
}
