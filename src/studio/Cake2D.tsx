import { useId, useMemo } from "react";
import type { CakeConfig } from "../domain/models";
import {
  normalizeCake,
  tierLayout,
  attachmentPosition,
  assetById,
  tierIdOf,
  UNIT,
  perimeterRadius,
} from "../domain/cakeScene";
export function Cake2D({
  config: input,
  selected,
  onSelect,
}: {
  config: CakeConfig;
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const config = useMemo(() => normalizeCake(input), [input]);
  const id = useId().replaceAll(":", ""),
    layouts = tierLayout(config);
  const height = layouts.at(-1)!.top + (config.topper ? 0.7 : 0.3),
    radius =
      Math.max(
        (config.board!.diameter * UNIT) / 2,
        ...layouts.map((l) => l.radius + Math.abs(l.x)),
      ) + 0.4;
  const scale = Math.min(350 / (2 * radius), 305 / height),
    base = 365;
  const point = ([x, y, z]: number[]) => [
    220 + x * scale,
    base - y * scale + z * scale * 0.22,
  ];
  const model = config.generatedModels?.find((m) => !m.hidden);
  // A generated mesh has no flat drawing. Where the tiers are hidden behind
  // one, this view shows the photograph it was made from.
  if (model && config.tiers.every((t) => t.hidden)) {
    const photo = config.referenceImages?.[0];
    return (
      <svg
        viewBox="0 0 440 440"
        role="img"
        aria-label={`${model.name}, a 3D model ${photo ? "generated from the reference photograph" : "edited in the 3D preview"}`}
        className="cake-2d"
      >
        {photo ? (
          <image
            href={photo.url}
            x="30"
            y="30"
            width="380"
            height="380"
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <text
            x="220"
            y="225"
            textAnchor="middle"
            fontSize="15"
            fill="#8a7777"
          >
            3D model · open the 3D preview to edit
          </text>
        )}
      </svg>
    );
  }
  const select = (key: string) => ({
    role: onSelect ? ("button" as const) : undefined,
    tabIndex: onSelect ? 0 : undefined,
    onClick: () => onSelect?.(key),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.(key);
      }
    },
    style: { cursor: onSelect ? "pointer" : undefined },
  });
  return (
    <svg
      viewBox="0 0 440 440"
      role="img"
      aria-label={`${config.tiers.length}-tier ${config.shape.toLowerCase()} ${config.flavor.toLowerCase()} cake with ${(
        config.objects || []
      )
        .map((o) => o.name)
        .filter((n, i, a) => a.indexOf(n) === i)
        .join(", ")}`}
      className="cake-2d"
    >
      <defs>
        <linearGradient id={`shade-${id}`}>
          <stop stopColor="#fff" stopOpacity=".22" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#4d302a" stopOpacity=".17" />
        </linearGradient>
      </defs>
      <ellipse
        cx="220"
        cy={base + 5}
        rx={((config.board!.diameter * UNIT) / 2) * scale}
        ry={((config.board!.diameter * UNIT) / 2) * scale * 0.22}
        fill="#b8ada4"
        opacity=".2"
      />
      <g {...select("board")} aria-label="Select cake board">
        <ellipse
          cx="220"
          cy={base}
          rx={((config.board!.diameter * UNIT) / 2) * scale}
          ry={((config.board!.diameter * UNIT) / 2) * scale * 0.22}
          fill={config.boardColor}
          stroke="#d8cec1"
        />
      </g>
      {layouts
        .filter((l) => !l.tier.hidden)
        .map((l, i) => {
          const [x, bottom] = point([l.x, l.bottom, l.z]),
            top = bottom - l.height * scale,
            r = l.radius * scale,
            ellipse =
              (l.tier.shape ?? config.shape) === "Square" ? r * 0.08 : r * 0.22;
          const shape = l.tier.shape ?? config.shape;
          const contour = Array.from({ length: 96 }, (_, j) => {
            const angle = (j / 96) * Math.PI * 2,
              rad = perimeterRadius(shape, l.radius, angle);
            return point([
              l.x + Math.cos(angle) * rad,
              l.top,
              l.z + Math.sin(angle) * rad,
            ]);
          });
          const topPath =
            contour
              .map((p, j) => `${j === 0 ? "M" : "L"}${p[0]} ${p[1]}`)
              .join(" ") + "Z";
          return (
            <g
              key={l.tier.id}
              {...select(l.tier.id)}
              aria-label={`Select ${i === 0 ? "bottom" : i === layouts.length - 1 ? "top" : i + 1} tier`}
            >
              <path
                d={`M${x - r} ${top}V${bottom}A${r} ${ellipse} 0 0 0 ${x + r} ${bottom}V${top}Z`}
                fill={l.tier.color}
              />
              <path
                d={`M${x - r} ${top}V${bottom}A${r} ${ellipse} 0 0 0 ${x + r} ${bottom}V${top}Z`}
                fill={`url(#shade-${id})`}
              />
              <path
                d={topPath}
                fill={l.tier.color}
                stroke="#fff"
                strokeOpacity=".5"
              />
              {shape === "Number" && (
                <text
                  x={x}
                  y={top + (bottom - top) * 0.7}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  fontSize={(bottom - top) * 0.6}
                  fill="#fff"
                  opacity={0.5}
                >
                  {config.number || "10"}
                </text>
              )}
              {["Textured", "Ruffled", "Rough", "Vintage", "Piped"].includes(
                l.tier.finish,
              ) &&
                Array.from(
                  { length: Math.floor((l.height * scale) / 7) },
                  (_, j) => (
                    <path
                      key={j}
                      d={`M${x - r} ${top + j * 7 + 5}q${r} ${ellipse * 1.7} ${2 * r} 0`}
                      fill="none"
                      stroke="#fff"
                      strokeWidth={l.tier.finish === "Ruffled" ? 3 : 1}
                      opacity=".25"
                    />
                  ),
                )}
              {l.tier.finish === "Drip" &&
                Array.from({ length: 12 }, (_, j) => (
                  <path
                    key={j}
                    d={`M${x - r + 5 + (j * (r * 2 - 10)) / 11} ${top + ellipse * Math.sin((j / 11) * Math.PI)}v${7 + ((j * 11) % 18)}`}
                    stroke="#fff0d4"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                ))}
              {selected === l.tier.id && (
                <path
                  d={`M${x - r - 3} ${top}V${bottom}q${r + 3} ${ellipse * 2} ${r * 2 + 6} 0V${top}`}
                  fill="none"
                  stroke="#8c709a"
                  strokeDasharray="4 3"
                />
              )}
            </g>
          );
        })}
      {(config.objects || [])
        .filter(
          (o) =>
            !o.hidden &&
            layouts.some((l) => l.tier.id === tierIdOf(o) && !l.tier.hidden),
        )
        .map((o) => {
          const l = layouts.find((l) => l.tier.id === tierIdOf(o))!;
          if (o.attachment.surface === "model") return null;
          if (
            o.attachment.surface === "side" &&
            Math.sin(o.attachment.angle) < -0.1
          )
            return null;
          const [x, y] = point(
              attachmentPosition(o.attachment, l, config.shape),
            ),
            kind = assetById(o.assetId)?.kind,
            s = o.scale * scale;
          return (
            <g
              key={o.id}
              {...select(o.id)}
              aria-label={`Select ${o.name}`}
              transform={`translate(${x},${y}) rotate(${(o.rotation[2] * 180) / Math.PI})`}
            >
              <g fill={o.color} stroke="#845d64" strokeWidth=".4">
                {kind === "rose" ? (
                  <>
                    {Array.from({ length: 16 }, (_, i) => {
                      const ring = i < 8 ? 1 : 0.55,
                        a = i * 2.399;
                      return (
                        <ellipse
                          key={i}
                          cx={Math.cos(a) * s * 0.13 * ring}
                          cy={Math.sin(a) * s * 0.12 * ring - s * 0.07}
                          rx={s * 0.16 * ring}
                          ry={s * 0.12 * ring}
                          transform={`rotate(${i * 137.5})`}
                        />
                      );
                    })}
                    <circle r={s * 0.04} />
                  </>
                ) : kind === "pearl" ? (
                  <circle r={s * 0.031} stroke="none" />
                ) : kind === "sprinkle" ? (
                  <rect x="-1" y="-3" width="2" height="6" rx="1" />
                ) : kind === "foil" ? (
                  <path d="M-2 -3L3 -1L1 4L-3 1Z" />
                ) : kind === "leaf" ? (
                  <ellipse rx={s * 0.08} ry={s * 0.2} />
                ) : kind === "macaron" ? (
                  <>
                    <ellipse cy={-s * 0.08} rx={s * 0.18} ry={s * 0.13} />
                    <path
                      d={`M${-s * 0.16} ${-s * 0.07}h${s * 0.32}`}
                      stroke="#fff7e7"
                      strokeWidth="2"
                    />
                  </>
                ) : kind === "chocolate" ? (
                  <rect
                    x={-s * 0.1}
                    y={-s * 0.38}
                    width={s * 0.2}
                    height={s * 0.38}
                  />
                ) : (
                  <ellipse cy={-s * 0.12} rx={s * 0.12} ry={s * 0.17} />
                )}
              </g>
              {selected === o.id && (
                <circle
                  r={Math.max(7, s * 0.35)}
                  fill="none"
                  stroke="#8c709a"
                  strokeDasharray="3 2"
                />
              )}
            </g>
          );
        })}
      {config.topper &&
        !config.lettering!.topper.hidden &&
        (() => {
          const s = config.lettering!.topper,
            p = s.position,
            [x, y] = point([
              layouts.at(-1)!.x + p[0] * UNIT,
              layouts.at(-1)!.top + 0.27 + p[1] * UNIT,
              p[2] * UNIT,
            ]);
          return (
            <g
              {...select("topper")}
              aria-label="Select topper"
              transform={`translate(${x},${y}) rotate(${(s.rotation[2] * -180) / Math.PI}) scale(${s.scale})`}
            >
              <path d="M-12 5V25M12 5V25" stroke={s.color} />
              <text
                textAnchor="middle"
                fill={s.color}
                fontFamily={
                  s.font === "great-vibes"
                    ? "Great Vibes"
                    : s.font === "optimer"
                      ? "Georgia"
                      : "sans-serif"
                }
                fontSize={s.size * UNIT * scale}
              >
                {config.topper}
              </text>
            </g>
          );
        })()}
      {config.text &&
        !config.lettering!.text.hidden &&
        (() => {
          const s = config.lettering!.text,
            p = s.position,
            l = layouts[0],
            [x, y] = point([
              l.x + p[0] * UNIT,
              l.bottom + l.height * 0.53 + p[1] * UNIT,
              l.radius + p[2] * UNIT,
            ]);
          return (
            <text
              {...select("text")}
              aria-label="Select lettering"
              transform={`translate(${x},${y}) rotate(${(s.rotation[2] * -180) / Math.PI}) scale(${s.scale})`}
              textAnchor="middle"
              fill={config.textColor}
              fontFamily={
                s.font === "great-vibes"
                  ? "Great Vibes"
                  : s.font === "optimer"
                    ? "Georgia"
                    : "sans-serif"
              }
              fontSize={((s.size * config.textSize) / 24) * UNIT * scale}
            >
              {config.text}
            </text>
          );
        })()}
    </svg>
  );
}
