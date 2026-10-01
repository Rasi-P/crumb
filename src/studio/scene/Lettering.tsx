import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import sans from "../assets/helvetiker_regular.typeface.json";
import script from "../assets/great-vibes.typeface.json";
import serif from "../assets/optimer_regular.typeface.json";
import type { CakeConfig } from "../../domain/models";
import { UNIT, type TierLayout } from "../../domain/cakeScene";
import { ObjectMaterial } from "./materials";
const fonts = {
  "great-vibes": new FontLoader().parse(script),
  helvetiker: new FontLoader().parse(sans),
  optimer: new FontLoader().parse(serif),
};
export function Lettering({
  config,
  layout,
  kind,
}: {
  config: CakeConfig;
  layout: TierLayout;
  kind: "text" | "topper";
}) {
  const settings = config.lettering![kind],
    message = config[kind];
  const topper = kind === "topper";
  const size =
    (topper ? settings.size : (settings.size * config.textSize) / 24) * UNIT;
  const geometry = useMemo(() => {
    if (!message) return new THREE.BufferGeometry();
    let text = message;
    if (topper && message.length > 12) {
      const words = message.split(" ");
      if (words.length > 1) {
        const middle = Math.ceil(words.length / 2);
        text =
          words.slice(0, middle).join(" ") +
          "\n" +
          words.slice(middle).join(" ");
      }
    }
    const extruded = new TextGeometry(text, {
      font: fonts[settings.font],
      size,
      depth: settings.depth * UNIT,
      curveSegments: topper ? 6 : 4,
      bevelEnabled: true,
      bevelThickness: 0.0008,
      bevelSize: 0.0006,
      bevelSegments: 1,
    });
    const g = mergeVertices(extruded, 1e-6);
    extruded.dispose();
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const width = b.max.x - b.min.x;
    const fit = Math.min(
      1,
      (layout.radius * (topper ? 1.9 : 2.25)) / Math.max(width, 0.001),
    );
    g.scale(fit, fit, 1);
    g.computeBoundingBox();
    g.translate(
      -(g.boundingBox!.max.x + g.boundingBox!.min.x) / 2,
      -g.boundingBox!.min.y,
      0,
    );
    if (!topper) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          a = x / (layout.radius + 0.008),
          z = p.getZ(i);
        p.setX(i, Math.sin(a) * (layout.radius + 0.008 + z));
        p.setZ(i, Math.cos(a) * (layout.radius + 0.008 + z));
      }
      g.computeVertexNormals();
    }
    g.computeBoundingBox();
    return g;
  }, [message, settings.font, settings.depth, size, layout.radius, topper]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (settings.hidden || !message) return null;
  return (
    <group
      position={[
        layout.x + settings.position[0] * UNIT,
        (topper ? layout.top + 0.27 : layout.bottom + layout.height * 0.53) +
          settings.position[1] * UNIT,
        layout.z + settings.position[2] * UNIT,
      ]}
      rotation={settings.rotation}
      scale={settings.scale}
      userData={{ sceneId: kind }}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <ObjectMaterial
          object={{
            material: settings.material,
            color: topper ? settings.color : config.textColor,
          }}
        />
      </mesh>
      {topper &&
        [0].map((s) => (
          <mesh
            key={s}
            position={[
              s * Math.min(0.22, layout.radius * 0.25),
              (geometry.boundingBox!.max.y * 0.64 - 0.32) / 2,
              -0.006,
            ]}
            castShadow
          >
            <boxGeometry
              args={[0.009, geometry.boundingBox!.max.y * 0.64 + 0.32, 0.006]}
            />
            <ObjectMaterial object={settings} />
          </mesh>
        ))}
    </group>
  );
}
