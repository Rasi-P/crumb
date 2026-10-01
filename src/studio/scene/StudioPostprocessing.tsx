import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Small-scale occlusion gives petals and tier junctions depth under a large softbox.
// A multisampled HDR target retains fine lettering edges before tone mapping.
export function StudioPostprocessing() {
  const { gl, scene, camera, size, invalidate } = useThree();
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
    const output = new OutputPass();
    composer.addPass(render);
    composer.addPass(ao);
    composer.addPass(output);
    return { composer, ao, render, output };
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
    const casters: string[] = [];
    scene.traverseVisible((o) => {
      if (o instanceof THREE.Mesh && o.castShadow) {
        casters.push(
          `${o.uuid}:${o.geometry.uuid}:${o.matrixWorld.elements.join(",")}:${o instanceof THREE.InstancedMesh ? o.instanceMatrix.version : ""}`,
        );
      }
    });
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
