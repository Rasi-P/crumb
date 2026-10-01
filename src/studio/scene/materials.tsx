import { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { CakeObject, Tier } from "../../domain/models";
import { seedValue } from "../../domain/cakeScene";
export const materialPresets: Record<
  CakeObject["material"],
  {
    roughness: number;
    metalness: number;
    specularIntensity: number;
    sheen?: number;
    clearcoat?: number;
  }
> = {
  Buttercream: {
    roughness: 0.79,
    metalness: 0,
    specularIntensity: 0.28,
    sheen: 0.14,
  },
  Fondant: { roughness: 0.62, metalness: 0, specularIntensity: 0.32 },
  Cream: {
    roughness: 0.84,
    metalness: 0,
    specularIntensity: 0.24,
    sheen: 0.18,
  },
  Chocolate: {
    roughness: 0.3,
    metalness: 0,
    specularIntensity: 0.7,
    clearcoat: 0.15,
  },
  Gold: { roughness: 0.25, metalness: 1, specularIntensity: 1 },
  Silver: { roughness: 0.21, metalness: 1, specularIntensity: 1 },
  Petal: {
    roughness: 0.52,
    metalness: 0,
    specularIntensity: 0.25,
    sheen: 0.15,
  },
  Satin: { roughness: 0.46, metalness: 0, specularIntensity: 0.5, sheen: 0.8 },
};
export function surfaceTexture(finish = "Smooth") {
  const size = 512,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const grain =
        seedValue(x + y * size) * 0.7 +
        seedValue(Math.floor(x / 3) + Math.floor(y / 3) * 91) * 0.3;
      const scrape =
        finish === "Textured" || finish === "Ruffled"
          ? Math.sin(y * 0.65 + Math.sin(x * 0.08) * 0.2) * 20
          : Math.sin(y * 0.31 + Math.sin(x * 0.03)) * 3;
      const v = 128 + (grain - 0.5) * (finish === "Rough" ? 100 : 42) + scrape,
        n = (y * size + x) * 4;
      data[n] = data[n + 1] = data[n + 2] = v;
      data[n + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
export function petalTexture() {
  const size = 256,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = y / size,
        u = (x / size - 0.5) / (0.35 + v);
      const veins = Math.sin(u * 100 + Math.sin(v * 7) * 1.5) * 0.5 + 0.5;
      const n = (y * size + x) * 4;
      data[n] =
        data[n + 1] =
        data[n + 2] =
          105 + veins * 35 + seedValue(n) * 22;
      data[n + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
export function FrostingMaterial({ tier }: { tier: Tier }) {
  const bump = useMemo(() => surfaceTexture(tier.finish), [tier.finish]);
  useEffect(() => () => bump.dispose(), [bump]);
  const type =
    tier.frosting === "Ganache"
      ? "Chocolate"
      : tier.frosting === "Whipped Cream"
        ? "Cream"
        : tier.frosting;
  const finishShader = useCallback<
    THREE.MeshPhysicalMaterial["onBeforeCompile"]
  >(
    (shader) => {
      shader.uniforms.handmade = { value: tier.imperfection ?? 0.4 };
      shader.uniforms.finishStrength = {
        value:
          tier.finish === "Rough" ? 3 : tier.finish === "Textured" ? 1.8 : 0.7,
      };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vFrostingPosition;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvFrostingPosition = position;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
      varying vec3 vFrostingPosition;
      uniform float handmade;
      uniform float finishStrength;
      float frostingHash(vec3 p) { p = fract(p * .3183099 + vec3(.1,.2,.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float frostingNoise(vec3 p) {
        vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(frostingHash(i),frostingHash(i+vec3(1,0,0)),f.x),mix(frostingHash(i+vec3(0,1,0)),frostingHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(frostingHash(i+vec3(0,0,1)),frostingHash(i+vec3(1,0,1)),f.x),mix(frostingHash(i+vec3(0,1,1)),frostingHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
    `,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
      float creamCloud = frostingNoise(vFrostingPosition * 11.0);
      diffuseColor.rgb *= 1.0 - handmade * .09 * creamCloud;
    `,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
      // Object-space spatula sweeps avoid the pinched UVs at a lathed tier's top.
      float sweep = sin(vFrostingPosition.y * 180.0 + frostingNoise(vFrostingPosition * vec3(8.0,2.0,8.0)) * 5.0);
      float surface = handmade * finishStrength * (.0010 * frostingNoise(vFrostingPosition * 67.0) + .0004 * frostingNoise(vFrostingPosition.zxy * 137.0 + 4.2) + .00022 * sweep);
      vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
      vec3 rx = cross(dpdy, normal), ry = cross(normal, dpdx);
      float determinant = dot(dpdx, rx) * faceDirection;
      vec3 gradient = sign(determinant) * (dFdx(surface) * rx + dFdy(surface) * ry);
      normal = normalize(abs(determinant) * normal - gradient);
    `,
        );
    },
    [tier.imperfection, tier.finish],
  );
  return (
    <meshPhysicalMaterial
      key={`${tier.finish}:${tier.imperfection}`}
      onBeforeCompile={finishShader}
      customProgramCacheKey={() => "frosting-surface-v4"}
      {...materialPresets[type]}
      color={tier.color}
      vertexColors
      roughness={tier.roughness ?? materialPresets[type].roughness}
      specularIntensity={
        tier.specular ?? materialPresets[type].specularIntensity
      }
      bumpMap={bump}
      bumpScale={
        (tier.finish === "Rough" ? 0.06 : 0.022) * (tier.imperfection ?? 0.4)
      }
      envMapIntensity={0.75}
      sheenColor="#fff4e8"
    />
  );
}
export function ObjectMaterial({
  object,
}: {
  object: Pick<CakeObject, "material" | "color">;
}) {
  return (
    <meshPhysicalMaterial
      {...materialPresets[object.material]}
      color={object.color}
      side={THREE.DoubleSide}
      envMapIntensity={1}
      sheenColor={object.color}
    />
  );
}
