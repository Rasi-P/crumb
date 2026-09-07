import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import fontData from "./assets/helvetiker_regular.typeface.json";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CakeConfig, Tier } from "../domain/models";

type Props = {
  config: CakeConfig;
  selected?: string;
  onSelect?: (id: string) => void;
  view?: string;
  zoom?: number;
  reset?: number;
  autoRotate?: boolean;
};
const font = new FontLoader().parse(fontData);
function FrostingShape({
  shape,
  radius,
  height,
  color,
  number,
}: {
  shape: CakeConfig["shape"];
  radius: number;
  height: number;
  color: string;
  number: string;
}) {
  const geometry = useMemo(() => {
    if (shape === "Round")
      return new THREE.CylinderGeometry(radius, radius, height, 80);
    if (shape === "Square")
      return new THREE.BoxGeometry(radius * 1.7, height, radius * 1.7, 1, 1, 1);
    let path: THREE.Shape | THREE.Shape[];
    if (shape === "Heart") {
      const heart = new THREE.Shape();
      heart.moveTo(0, -0.72);
      heart.bezierCurveTo(-0.35, -0.4, -1.2, 0.1, -0.9, 0.65);
      heart.bezierCurveTo(-0.6, 1.15, -0.1, 0.85, 0, 0.55);
      heart.bezierCurveTo(0.1, 0.85, 0.6, 1.15, 0.9, 0.65);
      heart.bezierCurveTo(1.2, 0.1, 0.35, -0.4, 0, -0.72);
      path = heart;
    } else if (shape === "Number")
      path = font.generateShapes(number || "10", 1.6);
    else {
      const custom = new THREE.Shape();
      for (let i = 0; i <= 160; i++) {
        const a = (i / 160) * Math.PI * 2;
        const r = 1 + Math.cos(a * 6) * 0.1;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (!i) custom.moveTo(x, y);
        else custom.lineTo(x, y);
      }
      path = custom;
    }
    const geo = new THREE.ExtrudeGeometry(path, {
      depth: height,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 24,
    });
    geo.computeBoundingBox();
    const size = new THREE.Vector3();
    geo.boundingBox!.getSize(size);
    geo.translate(
      -(geo.boundingBox!.max.x + geo.boundingBox!.min.x) / 2,
      -(geo.boundingBox!.max.y + geo.boundingBox!.min.y) / 2,
      -height / 2,
    );
    geo.scale((radius * 1.8) / size.x, (radius * 1.8) / size.y, 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [shape, radius, height, number]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh castShadow receiveShadow geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.78} />
    </mesh>
  );
}
function Rose({
  position,
  size = 0.19,
  color = "#e9b8c5",
  flower = false,
}: {
  position: [number, number, number];
  size?: number;
  color?: string;
  flower?: boolean;
}) {
  return (
    <group position={position} rotation={[0.15, 0.4, -0.18]}>
      {[0, 1].map((ring) =>
        Array.from({ length: ring ? 6 : 8 }, (_, i) => {
          const angle = (i / (ring ? 6 : 8)) * Math.PI * 2 + ring * 0.3;
          return (
            <mesh
              key={`${ring}-${i}`}
              castShadow
              position={[
                Math.cos(angle) * size * (ring ? 0.29 : 0.6),
                ring * 0.055,
                Math.sin(angle) * size * (ring ? 0.29 : 0.6),
              ]}
              rotation={[Math.sin(angle) * 0.55, angle, Math.cos(angle) * 0.55]}
              scale={[
                size * (ring ? 0.58 : 0.8),
                size * 0.28,
                size * (ring ? 0.62 : 0.8),
              ]}
            >
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial
                color={flower ? "#fff9ee" : ring ? "#efc4ce" : color}
                roughness={0.8}
              />
            </mesh>
          );
        }),
      )}
      <mesh position={[0, 0.07, 0]} castShadow>
        <sphereGeometry args={[size * 0.3, 14, 10]} />
        <meshStandardMaterial color={flower ? "#d7ba67" : "#d69cad"} />
      </mesh>
      {[-1, 1].map((sign, i) => (
        <mesh
          key={sign}
          position={[sign * size * 1.08, -0.03, size * 0.2]}
          rotation={[0.2, sign * 0.7, sign * 0.3]}
          scale={[size * 0.85, size * 0.12, size * 0.34]}
        >
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial
            color={i ? "#99aa84" : "#809575"}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}
function DecorationSet({
  tier,
  radius,
  y,
  index,
}: {
  tier: Tier;
  radius: number;
  y: number;
  index: number;
}) {
  const has = (s: string) =>
    tier.decorations.includes(s as Tier["decorations"][number]);
  const coords = (angle: number, r = radius) =>
    [Math.cos(angle) * r, y, Math.sin(angle) * r] as [number, number, number];
  return (
    <group>
      {(has("Roses") || has("Flowers")) &&
        [0.45, 0.82, 1.12, 3.6].map((angle, n) => (
          <Rose
            key={angle}
            position={[
              Math.cos(angle) * radius * 0.86,
              y + 0.045,
              Math.sin(angle) * radius * 0.86,
            ]}
            size={n === 0 ? 0.19 : n === 3 ? 0.18 : 0.13}
            flower={has("Flowers") && !has("Roses")}
          />
        ))}
      {has("Pearls") &&
        Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          return (
            <mesh
              key={i}
              castShadow
              position={[
                Math.cos(a) * (radius + 0.007),
                y - tier.height * 0.27 + 0.045,
                Math.sin(a) * (radius + 0.007),
              ]}
            >
              <sphereGeometry args={[0.034, 10, 8]} />
              <meshStandardMaterial
                color="#d5b971"
                metalness={0.65}
                roughness={0.28}
              />
            </mesh>
          );
        })}
      {has("Gold accents") &&
        Array.from({ length: 32 }, (_, i) => {
          const angle = i * 2.399;
          const h = y - (((i * 17) % 83) / 100) * tier.height * 0.27 - 0.04;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * (radius + 0.007),
                h,
                Math.sin(angle) * (radius + 0.007),
              ]}
              rotation={[0, -angle + Math.PI / 2, i * 0.7]}
              scale={[0.015 + (i % 3) * 0.014, 0.03 + (i % 4) * 0.012, 1]}
            >
              <circleGeometry args={[1, 5]} />
              <meshStandardMaterial
                color="#d1b677"
                metalness={0.4}
                roughness={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}
      {has("Sprinkles") &&
        Array.from({ length: 100 }, (_, i) => {
          const angle = i * 2.399;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * (radius + 0.012),
                y - 0.035 - (((i * 17) % 87) / 100) * tier.height * 0.27,
                Math.sin(angle) * (radius + 0.012),
              ]}
              rotation={[i * 0.42, 0, i * 0.77]}
            >
              <capsuleGeometry args={[0.011, 0.047, 3, 5]} />
              <meshStandardMaterial
                color={
                  ["#d5a0c1", "#95bed7", "#ead391", "#a9bd90", "#b4a0cf"][i % 5]
                }
              />
            </mesh>
          );
        })}
      {has("Macarons") &&
        [0.7, 1.4, 2.1].map((angle, i) => (
          <group
            key={angle}
            position={coords(angle, radius * 0.67)}
            rotation={[0, angle, 0.22]}
          >
            <mesh position={[0, 0.085, 0]} castShadow>
              <sphereGeometry args={[0.13, 20, 14]} />
              <meshStandardMaterial
                color={["#d9bbca", "#bccba1", "#e3b3a2"][i]}
              />
            </mesh>
            <mesh position={[0, 0.085, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.129, 0.016, 6, 24]} />
              <meshStandardMaterial color="#fff4e3" />
            </mesh>
          </group>
        ))}
      {has("Chocolate") &&
        [0.3, 1, 1.7, 2.4, 3.1].map((a, i) => (
          <mesh
            key={a}
            position={[
              Math.cos(a) * radius * 0.6,
              y + 0.13,
              Math.sin(a) * radius * 0.6,
            ]}
            rotation={[0.25, a, 0.25]}
            castShadow
          >
            <boxGeometry args={[0.17, 0.35, 0.065]} />
            <meshStandardMaterial
              color={i % 2 ? "#573729" : "#392720"}
              roughness={0.36}
            />
          </mesh>
        ))}
      {has("Fruit") &&
        [0.5, 1.1, 1.7, 2.3, 2.9].map((a) => (
          <group key={a} position={coords(a, radius * 0.66)}>
            <mesh position={[0, 0.1, 0]} castShadow scale={[1, 1.35, 1]}>
              <sphereGeometry args={[0.1, 14, 10]} />
              <meshStandardMaterial color="#be5053" roughness={0.48} />
            </mesh>
            {[0, 1, 2, 3].map((i) => (
              <mesh
                key={i}
                position={[0, 0.235, 0]}
                rotation={[Math.PI / 2, 0, (i * Math.PI) / 2]}
                scale={[1, 0.35, 1]}
              >
                <coneGeometry args={[0.045, 0.12, 3]} />
                <meshStandardMaterial color="#778e62" />
              </mesh>
            ))}
          </group>
        ))}
      {has("Ribbons") && (
        <>
          <mesh position={[0, y - tier.height * 0.27 + 0.13, 0]}>
            <cylinderGeometry
              args={[radius + 0.01, radius + 0.01, 0.105, 80, 1, true]}
            />
            <meshStandardMaterial
              color="#be859b"
              roughness={0.65}
              side={THREE.DoubleSide}
            />
          </mesh>
          {[-1, 1].map((sign) => (
            <mesh
              key={sign}
              position={[
                sign * 0.1,
                y - tier.height * 0.27 + 0.13,
                radius + 0.04,
              ]}
              rotation={[0, 0, sign * 0.3]}
              scale={[1, 0.55, 0.25]}
            >
              <torusGeometry args={[0.12, 0.035, 8, 18]} />
              <meshStandardMaterial color="#d19aad" />
            </mesh>
          ))}
        </>
      )}
      {has("Characters") && (
        <group position={[0, y + 0.12, 0]}>
          <mesh position={[0, 0.19, 0]} castShadow>
            <sphereGeometry args={[0.2, 20, 14]} />
            <meshStandardMaterial color="#d9bc94" />
          </mesh>
          {[-1, 1].map((sign) => (
            <group key={sign}>
              <mesh position={[sign * 0.15, 0.36, 0]}>
                <sphereGeometry args={[0.09, 14, 10]} />
                <meshStandardMaterial color="#d9bc94" />
              </mesh>
              <mesh position={[sign * 0.075, 0.22, 0.18]}>
                <sphereGeometry args={[0.017, 10, 8]} />
                <meshStandardMaterial color="#423531" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.14, 0.18]} scale={[1, 0.8, 0.6]}>
            <sphereGeometry args={[0.07, 14, 10]} />
            <meshStandardMaterial color="#f2ddbc" />
          </mesh>
          <mesh position={[0, 0.17, 0.223]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color="#665044" />
          </mesh>
        </group>
      )}
      {has("Leaves") &&
        Array.from({ length: 8 }, (_, i) => (
          <mesh
            key={i}
            position={coords(3.2 + i * 0.12, radius * 0.85)}
            rotation={[0, i * 0.4, 0]}
            scale={[0.14, 0.019, 0.047]}
          >
            <sphereGeometry args={[1, 10, 6]} />
            <meshStandardMaterial color={i % 2 ? "#a2b190" : "#859b7c"} />
          </mesh>
        ))}
    </group>
  );
}
function Lettering({
  text,
  color,
  position,
  size = 1.3,
  style = "Elegant",
  radius,
}: {
  text: string;
  color: string;
  position: [number, number, number];
  size?: number;
  style?: string;
  radius?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 1024, 256);
    ctx.fillStyle = color;
    ctx.font = `${style === "Elegant" ? "italic " : ""}${text.length > 25 ? 56 : 72}px ${style === "Modern" ? "sans-serif" : style === "Playful" ? "cursive" : "Georgia"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 128, 990);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [text, color, style]);
  useEffect(() => () => texture.dispose(), [texture]);
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(size, size / 4, 64, 1);
    if (radius) {
      const points = plane.attributes.position;
      for (let i = 0; i < points.count; i++) {
        const angle = points.getX(i) / radius;
        points.setX(i, Math.sin(angle) * radius);
        points.setZ(i, Math.cos(angle) * radius);
      }
      plane.computeVertexNormals();
    }
    return plane;
  }, [size, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh position={position} geometry={geometry}>
      <meshBasicMaterial
        map={texture}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
function Scene({ config, selected, onSelect }: Props) {
  let base = 0.16;
  const tiers = config.tiers.map((t) => {
    const h = t.height * 0.27;
    const item = {
      tier: t,
      y: base + h / 2,
      top: base + h,
      r: t.diameter * 0.135,
      h,
    };
    base += h;
    return item;
  });
  const bottom = tiers[0];
  const top = tiers[tiers.length - 1];
  return (
    <group>
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[bottom.r + 0.25, bottom.r + 0.25, 0.11, 96]} />
        <meshStandardMaterial color={config.boardColor} roughness={0.48} />
      </mesh>
      {tiers.map(({ tier, y, top, r, h }, i) => (
        <group
          key={tier.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(tier.id);
          }}
        >
          <group position={[0, y, 0]}>
            <FrostingShape
              shape={config.shape}
              radius={r}
              height={h}
              color={tier.color}
              number={config.number}
            />
          </group>
          {config.shape === "Round" &&
            ["Textured", "Vintage", "Ruffled"].includes(tier.finish) &&
            Array.from({ length: Math.round(h / 0.075) }, (_, n) => (
              <mesh
                key={n}
                position={[0, top - h + 0.055 + n * 0.075, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <torusGeometry
                  args={[
                    r + 0.001,
                    tier.finish === "Ruffled" ? 0.018 : 0.005,
                    5,
                    80,
                  ]}
                />
                <meshStandardMaterial color={tier.color} roughness={0.9} />
              </mesh>
            ))}
          {tier.finish === "Vintage" &&
            [top, top - h + 0.03].map((height, n) =>
              Array.from({ length: 40 }, (_, p) => {
                const a = (p / 40) * Math.PI * 2;
                return (
                  <mesh
                    key={`${n}-${p}`}
                    position={[Math.cos(a) * r, height, Math.sin(a) * r]}
                    scale={[1, 0.8, 1]}
                    castShadow
                  >
                    <sphereGeometry args={[0.055, 10, 8]} />
                    <meshStandardMaterial color={tier.color} />
                  </mesh>
                );
              }),
            )}
          {tier.finish === "Drip" &&
            Array.from({ length: 24 }, (_, n) => {
              const a = (n / 24) * Math.PI * 2;
              const length = 0.1 + ((n * 13) % 21) / 100;
              return (
                <mesh
                  key={n}
                  position={[
                    Math.cos(a) * (r + 0.003),
                    top - length / 2,
                    Math.sin(a) * (r + 0.003),
                  ]}
                  castShadow
                >
                  <capsuleGeometry args={[0.026, length, 5, 8]} />
                  <meshStandardMaterial
                    color={
                      config.flavor === "Chocolate" ? "#38261f" : "#b4776f"
                    }
                    roughness={0.35}
                  />
                </mesh>
              );
            })}
          <DecorationSet tier={tier} radius={r} y={top} index={i} />
          {selected === tier.id && (
            <mesh
              position={[0, top - h + 0.01, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[r + 0.055, 0.012, 6, 80]} />
              <meshBasicMaterial color="#9c7cab" />
            </mesh>
          )}
        </group>
      ))}
      {config.text && (
        <Lettering
          text={config.text}
          color={config.textColor}
          style={config.textStyle}
          position={[
            0,
            bottom.y - 0.03,
            config.shape === "Round" ? 0 : bottom.r + 0.012,
          ]}
          radius={config.shape === "Round" ? bottom.r + 0.013 : undefined}
          size={Math.min(bottom.r * 1.6, config.textSize / 14)}
        />
      )}{" "}
      {config.topper && (
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.("topper");
          }}
        >
          {[-0.23, 0.23].map((x) => (
            <mesh key={x} position={[x, top.top + 0.22, 0]}>
              <cylinderGeometry args={[0.009, 0.009, 0.55, 6]} />
              <meshStandardMaterial
                color="#bba069"
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
          ))}
          <Lettering
            text={config.topper}
            color="#b29456"
            position={[0, top.top + 0.51, 0.01]}
            size={1.3}
          />
        </group>
      )}
    </group>
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
  const { camera, size } = useThree();
  const height = config.tiers.reduce((n, t) => n + t.height * 0.27, 0);
  useEffect(() => {
    const target = new THREE.Vector3(0, height * 0.49 + 0.15, 0);
    const aspect = size.width / Math.max(1, size.height);
    const distance = Math.max(
      6.2,
      height * 2.35,
      config.tiers[0].diameter * 0.78,
      ((config.tiers[0].diameter * 0.135 + 0.34) /
        (Math.tan(Math.PI / 10) * aspect)) *
        1.2,
    );
    const v =
      view === "Front"
        ? [0, height * 0.5 + 0.18, distance]
        : view === "Side"
          ? [distance, height * 0.5 + 0.18, 0]
          : view === "Top"
            ? [0, distance + height, 0.01]
            : [
                distance * 0.72,
                height * 0.55 + distance * 0.42,
                distance * 0.87,
              ];
    camera.position.set(...(v as [number, number, number]));
    camera.zoom = Math.max(0.5, Math.min(2.5, 1 + zoom * 0.13));
    camera.updateProjectionMatrix();
    controls.current?.target.copy(target);
    controls.current?.update();
  }, [
    view,
    reset,
    zoom,
    config.tiers.length,
    config.tiers[0].diameter,
    height,
    camera,
    size.width,
    size.height,
  ]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={2.5}
      maxDistance={30}
      maxPolarAngle={Math.PI * 0.49}
      target={[0, height * 0.49 + 0.15, 0]}
      autoRotate={autoRotate}
      autoRotateSpeed={0.65}
      enablePan={false}
    />
  );
}
export default function Cake3D(props: Props) {
  return (
    <div className="cake-3d">
      <Canvas
        frameloop={props.autoRotate ? "always" : "demand"}
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 1.5]}
        camera={{ position: [5, 4, 6], fov: 36, near: 0.1, far: 150 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        fallback={
          <div className="webgl-fallback">
            3D needs WebGL support. Your editable 2D design is available in the
            Design tab.
          </div>
        }
      >
        <color attach="background" args={["#eeedf0"]} />
        <ambientLight intensity={0.8} />
        <hemisphereLight args={["#fff7f1", "#d7d1dc", 0.7]} />
        <directionalLight
          position={[-3, 7, 5]}
          intensity={2.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={6}
          shadow-camera-bottom={-3}
          shadow-bias={-0.001}
        />
        <directionalLight
          position={[4, 4, -3]}
          intensity={1.1}
          color="#f9efff"
        />
        <Suspense fallback={null}>
          <Scene {...props} />
          <ContactShadows
            key={JSON.stringify(
              props.config.tiers.map((t) => [t.diameter, t.height]),
            )}
            position={[0, 0.015, 0]}
            opacity={0.23}
            scale={13}
            blur={3.6}
            far={5}
            resolution={256}
            frames={1}
          />
        </Suspense>
        <CameraControls {...props} />
      </Canvas>
    </div>
  );
}
