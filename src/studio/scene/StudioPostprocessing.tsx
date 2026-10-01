import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  Pass,
  FullScreenQuad,
} from "three/examples/jsm/postprocessing/Pass.js";

// Draws a crisp line around the silhouette of the selected objects. three's
// own OutlinePass blends additively, which vanishes on this pale studio set.
class SelectionOutlinePass extends Pass {
  selected: THREE.Object3D[] = [];
  private readonly mask = new THREE.WebGLRenderTarget(1, 1);
  private readonly white = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    side: THREE.DoubleSide,
  });
  private readonly quad = new FullScreenQuad(
    new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tMask: { value: null },
        texel: { value: new THREE.Vector2() },
        color: { value: new THREE.Color("#7b4f96") },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform sampler2D tMask; uniform vec2 texel; uniform vec3 color; varying vec2 vUv;
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          float inside = texture2D(tMask, vUv).r, reach = 0.0;
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 0.5235988;
            vec2 d = vec2(cos(a), sin(a)) * texel;
            reach = max(reach, max(texture2D(tMask, vUv + d * 2.6).r, texture2D(tMask, vUv + d * 1.3).r));
          }
          gl_FragColor = vec4(mix(base.rgb, color, reach * (1.0 - inside) * 0.92), base.a);
        }`,
    }),
  );
  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    super();
  }
  setSize(width: number, height: number) {
    this.mask.setSize(width, height);
    const ratio = Math.max(1, width / Math.max(1, window.innerWidth));
    (this.quad.material as THREE.ShaderMaterial).uniforms.texel.value.set(
      ratio / width,
      ratio / height,
    );
  }
  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ) {
    const material = this.quad.material as THREE.ShaderMaterial,
      keep = new Set<THREE.Object3D>();
    for (const root of this.selected) root.traverse((o) => keep.add(o));
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      const drawable = o as THREE.Mesh;
      if (
        (drawable.isMesh ||
          (o as THREE.Line).isLine ||
          (o as THREE.Points).isPoints) &&
        o.visible &&
        !keep.has(o)
      ) {
        o.visible = false;
        hidden.push(o);
      }
    });
    const background = this.scene.background,
      override = this.scene.overrideMaterial,
      clearAlpha = renderer.getClearAlpha(),
      clear = renderer.getClearColor(new THREE.Color());
    try {
      this.scene.background = null;
      this.scene.overrideMaterial = this.white;
      renderer.setClearColor(0x000000, 1);
      renderer.setRenderTarget(this.mask);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      this.scene.background = background;
      this.scene.overrideMaterial = override;
      renderer.setClearColor(clear, clearAlpha);
      hidden.forEach((o) => (o.visible = true));
    }
    material.uniforms.tDiffuse.value = readBuffer.texture;
    material.uniforms.tMask.value = this.mask.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    this.mask.dispose();
    this.white.dispose();
    this.quad.dispose();
  }
}

// Small-scale occlusion gives petals and tier junctions depth under a large softbox.
// A multisampled HDR target retains fine lettering edges before tone mapping.
export function StudioPostprocessing({
  selection = [],
}: {
  selection?: string[];
}) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const selected = useRef(selection);
  selected.current = selection;
  useEffect(() => invalidate(), [selection, invalidate]);
  const shadowRevision = useRef("");
  const pipeline = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(4, gl.capabilities.maxSamples),
    });
    const composer = new EffectComposer(gl, target);
    const render = new RenderPass(scene, camera);
    const ao = new GTAOPass(scene, camera, 1, 1);
    ao.updateGtaoMaterial({
      radius: 0.16,
      thickness: 0.7,
      scale: 0.8,
      samples: 16,
      distanceFallOff: 0.7,
    });
    ao.updatePdMaterial({ radius: 3, samples: 8, depthPhi: 5, normalPhi: 8 });
    ao.blendIntensity = 0.75;
    ao.normalMaterial.side = THREE.DoubleSide;
    // The normals pass must not overwrite the actual lighting shadow maps.
    const renderAO = ao.render.bind(ao);
    ao.render = (...args) => {
      const shadowUpdate = gl.shadowMap.autoUpdate;
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh && o.visible && o.material?.transparent) {
          hidden.push(o);
          o.visible = false;
        }
      });
      try {
        gl.shadowMap.autoUpdate = false;
        renderAO(...args);
      } finally {
        gl.shadowMap.autoUpdate = shadowUpdate;
        hidden.forEach((o) => {
          o.visible = true;
        });
      }
    };
    const outline = new SelectionOutlinePass(scene, camera);
    const output = new OutputPass();
    composer.addPass(render);
    composer.addPass(ao);
    composer.addPass(outline);
    composer.addPass(output);
    return { composer, ao, render, outline, output };
  }, [gl, scene, camera]);
  useEffect(() => {
    const ratio = Math.min(gl.getPixelRatio(), 1.5);
    pipeline.composer.setPixelRatio(ratio);
    pipeline.composer.setSize(size.width, size.height);
    // AO is low-frequency shading. Half resolution retains petal separation
    // while the actual product and lettering stay full-resolution/MSAA.
    pipeline.ao.setSize(
      Math.ceil((size.width * ratio) / 2),
      Math.ceil((size.height * ratio) / 2),
    );
    invalidate();
  }, [pipeline, size.width, size.height, gl, invalidate]);
  useEffect(
    () => () => {
      pipeline.ao.dispose();
      pipeline.outline.dispose();
      pipeline.output.dispose();
      pipeline.render.dispose();
      pipeline.composer.dispose();
    },
    [pipeline],
  );
  useFrame((_, delta) => {
    // Orbiting changes the view, not light-space shadows. Rebuild those only
    // when a caster changes, including asynchronously loaded GLBs and instances.
    scene.updateMatrixWorld();
    const casters: string[] = [],
      outlined: THREE.Object3D[] = [];
    scene.traverseVisible((o) => {
      const id: string | undefined = o.userData.sceneId;
      // Selecting a generated model outlines all of its parts.
      if (
        id &&
        selected.current.some((s) => id === s || id.startsWith(`${s}/`))
      )
        outlined.push(o);
      if (o instanceof THREE.Mesh && o.castShadow) {
        casters.push(
          `${o.uuid}:${o.geometry.uuid}:${o.matrixWorld.elements.join(",")}:${o instanceof THREE.InstancedMesh ? o.instanceMatrix.version : ""}`,
        );
      }
    });
    pipeline.outline.selected = outlined;
    pipeline.outline.enabled = outlined.length > 0;
    const revision = casters.join("|");
    const previous = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    if (shadowRevision.current !== revision) {
      gl.shadowMap.needsUpdate = true;
      shadowRevision.current = revision;
    }
    try {
      pipeline.composer.render(delta);
    } finally {
      gl.shadowMap.autoUpdate = previous;
    }
  }, 1);
  return null;
}
