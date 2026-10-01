import * as THREE from "three";
import type {
  CakeConfig,
  CakeObject,
  GeneratedModel,
  TierAttachment,
} from "../../domain/models";
import {
  attachmentPosition,
  modelAttachmentPosition,
  modelDirectionToWorld,
  perimeterRadius,
  UNIT,
  type TierLayout,
} from "../../domain/cakeScene";

export type SceneContext = {
  layouts: TierLayout[];
  models: GeneratedModel[];
  shape: CakeConfig["shape"];
};

const up = new THREE.Vector3(0, 1, 0);

function tierQuaternion(a: TierAttachment, shape: CakeConfig["shape"]) {
  if (a.surface === "top") return new THREE.Quaternion();
  const epsilon = 0.0001,
    r0 = perimeterRadius(shape, 1, a.angle - epsilon),
    r1 = perimeterRadius(shape, 1, a.angle + epsilon),
    dx = Math.cos(a.angle + epsilon) * r1 - Math.cos(a.angle - epsilon) * r0,
    dz = Math.sin(a.angle + epsilon) * r1 - Math.sin(a.angle - epsilon) * r0;
  return new THREE.Quaternion().setFromUnitVectors(
    up,
    new THREE.Vector3(dz, 0, -dx).normalize(),
  );
}

// Where an object sits in the world, derived from its surface attachment.
// The object's local +Y is the surface normal. Returns null when the tier or
// model it belongs to is missing or hidden.
export function placementOf(o: CakeObject, context: SceneContext) {
  const a = o.attachment;
  let position: THREE.Vector3, quaternion: THREE.Quaternion;
  if (a.surface === "model") {
    const model = context.models.find((m) => m.id === a.modelId);
    if (!model || model.hidden) return null;
    position = new THREE.Vector3(...modelAttachmentPosition(a, model));
    quaternion = new THREE.Quaternion().setFromUnitVectors(
      up,
      new THREE.Vector3(...modelDirectionToWorld(model, a.normal)).normalize(),
    );
  } else {
    const layout = context.layouts.find((l) => l.tier.id === a.tierId);
    if (!layout || layout.tier.hidden) return null;
    position = new THREE.Vector3(
      ...attachmentPosition(a, layout, context.shape),
    );
    quaternion = tierQuaternion(a, layout.tier.shape ?? context.shape);
  }
  if (o.nudge) position.add(new THREE.Vector3(...o.nudge).multiplyScalar(UNIT));
  return { position, quaternion };
}
