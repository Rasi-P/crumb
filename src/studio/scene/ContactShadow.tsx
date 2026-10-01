import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { HorizontalBlurShader } from "three/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/examples/jsm/shaders/VerticalBlurShader.js";
// A depth-based ambient contact pass. Preserve the product lights' shadow maps while
// rendering from below: offscreen depth passes must not replace their shadow state.
export function ContactShadow({
  revision,
  height,
}: {
  revision: string;
  height: number;
}) {
  const { gl, scene, invalidate } = useThree();
  const plane = useRef<THREE.Mesh>(null);
  const remaining = useRef(4);
  const resources = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(512, 512),
      scratch = new THREE.WebGLRenderTarget(512, 512);
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, height + 1);
    camera.position.set(0, 0.003, 0);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld();
    const depth = new THREE.MeshDepthMaterial();
    depth.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec4( vec3( 1.0 - fragCoordZ ), opacity )",
        "vec4( vec3(0.23, 0.16, 0.12), pow(1.0 - fragCoordZ, 4.0) )",
      );
    };
    const blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      blurGeometry = new THREE.PlaneGeometry(2, 2),
      horizontal = new THREE.ShaderMaterial(HorizontalBlurShader),
      vertical = new THREE.ShaderMaterial(VerticalBlurShader),
      quad = new THREE.Mesh(blurGeometry, horizontal);
    return {
      target,
      scratch,
      camera,
      depth,
      blurCamera,
      blurGeometry,
      horizontal,
      vertical,
      quad,
    };
  }, [height]);
  useEffect(() => {
    remaining.current = 4;
    invalidate();
  }, [revision, resources, invalidate]);
  useEffect(
    () => () => {
      resources.target.dispose();
      resources.scratch.dispose();
      resources.depth.dispose();
      resources.blurGeometry.dispose();
      resources.horizontal.dispose();
      resources.vertical.dispose();
    },
    [resources],
  );
  useFrame(() => {
    if (!remaining.current || !plane.current) return;
    remaining.current--;
    const {
      target,
      scratch,
      camera,
      depth,
      blurCamera,
      horizontal,
      vertical,
      quad,
    } = resources;
    const background = scene.background,
      override = scene.overrideMaterial,
      auto = gl.shadowMap.autoUpdate,
      renderTarget = gl.getRenderTarget(),
      clearAlpha = gl.getClearAlpha(),
      clear = gl.getClearColor(new THREE.Color());
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.studioFloor && o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    });
    plane.current.visible = false;
    try {
      gl.shadowMap.autoUpdate = false;
      scene.background = null;
      scene.overrideMaterial = depth;
      gl.setClearColor(0, 0);
      gl.setRenderTarget(target);
      gl.clear();
      gl.render(scene, camera);
      scene.overrideMaterial = null;
      for (const radius of [1.5, 0.6]) {
        horizontal.uniforms.tDiffuse.value = target.texture;
        horizontal.uniforms.h.value = radius / 512;
        quad.material = horizontal;
        gl.setRenderTarget(scratch);
        gl.clear();
        gl.render(quad, blurCamera);
        vertical.uniforms.tDiffuse.value = scratch.texture;
        vertical.uniforms.v.value = radius / 512;
        quad.material = vertical;
        gl.setRenderTarget(target);
        gl.clear();
        gl.render(quad, blurCamera);
      }
    } finally {
      scene.background = background;
      scene.overrideMaterial = override;
      gl.shadowMap.autoUpdate = auto;
      gl.setClearColor(clear, clearAlpha);
      gl.setRenderTarget(renderTarget);
      plane.current.visible = true;
      hidden.forEach((o) => (o.visible = true));
    }
    if (remaining.current) invalidate();
  });
  return (
    <mesh
      ref={plane}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.002, 0]}
      renderOrder={2}
    >
      <planeGeometry args={[10, 10]} />
      <meshBasicMaterial
        map={resources.target.texture}
        transparent
        opacity={0.52}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
