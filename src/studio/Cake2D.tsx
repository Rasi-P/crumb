import { useId } from "react";
import type { CakeConfig } from "../domain/models";

export function Cake2D({
  config,
  selected,
  onSelect,
}: {
  config: CakeConfig;
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const id = useId().replaceAll(":", "");
  const maxD = Math.max(...config.tiers.map((t) => t.diameter));
  const totalHeight = config.tiers.reduce((n, t) => n + t.height, 0);
  const scale = Math.min(31, 260 / totalHeight);
  const base = 345;
  const rx = maxD * 15 + 25;
  let y = base;
  const tiers = config.tiers.map((t) => {
    const h = t.height * scale;
    const item = { ...t, bottom: y, top: y - h, h, w: t.diameter * 15 };
    y -= h;
    return item;
  });
  const top = tiers[tiers.length - 1];
  return (
    <svg
      viewBox="0 0 440 440"
      role="img"
      aria-label={`${config.tiers.length}-tier ${config.shape.toLowerCase()} ${config.flavor.toLowerCase()} cake with ${Array.from(new Set(config.tiers.flatMap((t) => t.decorations))).join(", ")}`}
      className="cake-2d"
    >
      <defs>
        <filter id={`shadow-${id}`}>
          <feGaussianBlur stdDeviation="10" />
        </filter>
        {tiers.map((t, i) => (
          <linearGradient key={t.id} id={`tier-${id}-${i}`} x1="0" x2="1">
            <stop offset="0" stopColor={t.color} />
            <stop offset="0.38" stopColor={t.color} />
            <stop offset="1" stopColor="#53404b" stopOpacity="0.16" />
          </linearGradient>
        ))}
        <linearGradient id={`gold-${id}`}>
          <stop stopColor="#dfc886" />
          <stop offset="0.5" stopColor="#a78238" />
          <stop offset="1" stopColor="#dbc58b" />
        </linearGradient>
      </defs>
      <ellipse
        cx="220"
        cy={base + 29}
        rx={rx - 15}
        ry="17"
        fill="#635565"
        opacity="0.15"
        filter={`url(#shadow-${id})`}
      />
      <ellipse cx="220" cy={base + 10} rx={rx} ry="31" fill="#d6d0c8" />
      <ellipse
        cx="220"
        cy={base + 5}
        rx={rx}
        ry="31"
        fill={config.boardColor}
        stroke="#e2ddd5"
      />
      {tiers.map((t, i) => {
        const ellipse = config.shape === "Square" ? 7 : 25;
        return (
          <g
            key={t.id}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={
              onSelect
                ? `Select ${i === 0 ? "bottom" : i === tiers.length - 1 ? "top" : i + 1} tier`
                : undefined
            }
            onClick={() => onSelect?.(t.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect?.(t.id);
            }}
            style={{ cursor: onSelect ? "pointer" : undefined }}
          >
            <path
              d={`M${220 - t.w} ${t.top} L${220 - t.w} ${t.bottom} A${t.w} ${ellipse} 0 0 0 ${220 + t.w} ${t.bottom} L${220 + t.w} ${t.top} Z`}
              fill={t.color}
            />
            <path
              d={`M${220 - t.w} ${t.top} L${220 - t.w} ${t.bottom} A${t.w} ${ellipse} 0 0 0 ${220 + t.w} ${t.bottom} L${220 + t.w} ${t.top} Z`}
              fill={`url(#tier-${id}-${i})`}
            />
            {["Textured", "Ruffled", "Vintage"].includes(t.finish) &&
              Array.from({ length: Math.floor(t.h / 9) }, (_, n) => (
                <path
                  key={n}
                  d={`M${220 - t.w + 2} ${t.top + 9 + n * 9} Q220 ${t.top + 9 + n * 9 + ellipse * 1.6} ${220 + t.w - 2} ${t.top + 9 + n * 9}`}
                  fill="none"
                  stroke="#fff"
                  strokeOpacity="0.23"
                  strokeWidth={t.finish === "Ruffled" ? 4 : 1.5}
                />
              ))}
            <ellipse
              cx="220"
              cy={t.top}
              rx={t.w}
              ry={ellipse}
              fill={t.color}
              stroke="#fff"
              strokeOpacity="0.48"
            />
            {config.shape === "Heart" && (
              <path
                d={`M220 ${t.top + 19} C${220 - t.w - 30} ${t.top - 8} ${220 - t.w / 2} ${t.top - 43} 220 ${t.top - 12} C${220 + t.w / 2} ${t.top - 43} ${220 + t.w + 30} ${t.top - 8} 220 ${t.top + 19}`}
                fill={t.color}
                stroke="#fff"
                strokeOpacity="0.4"
              />
            )}
            {config.shape === "Number" && (
              <text
                x="220"
                y={t.top + t.h * 0.78}
                textAnchor="middle"
                fontSize={t.h * 0.82}
                fill="#fff"
                opacity="0.6"
                fontFamily="Georgia"
              >
                {config.number || "10"}
              </text>
            )}
            {config.shape === "Custom" &&
              Array.from({ length: 12 }, (_, n) => (
                <circle
                  key={n}
                  cx={220 + Math.cos((n / 12) * Math.PI * 2) * t.w * 0.92}
                  cy={t.top + Math.sin((n / 12) * Math.PI * 2) * ellipse}
                  r="7"
                  fill={t.color}
                />
              ))}
            {t.finish === "Drip" &&
              Array.from({ length: 11 }, (_, n) => (
                <path
                  key={n}
                  d={`M${220 - t.w + 12 + (n * (t.w * 2 - 24)) / 10} ${t.top + ellipse * Math.sin((n / 10) * Math.PI)}v${12 + ((n * 13) % 27)}`}
                  stroke={config.flavor === "Chocolate" ? "#3c2721" : "#aa746b"}
                  strokeWidth="8"
                  strokeLinecap="round"
                />
              ))}
            {["Vintage", "Ruffled"].includes(t.finish) &&
              Array.from({ length: 23 }, (_, n) => (
                <g key={n}>
                  <circle
                    cx={220 - t.w + 5 + (n * (t.w * 2 - 10)) / 22}
                    cy={t.bottom + ellipse * Math.sin((n / 22) * Math.PI)}
                    r={t.finish === "Vintage" ? 5.3 : 3.7}
                    fill={t.color}
                    stroke="#fff"
                    strokeOpacity="0.42"
                  />
                  <circle
                    cx={220 - t.w + 5 + (n * (t.w * 2 - 10)) / 22}
                    cy={t.top + ellipse * Math.sin((n / 22) * Math.PI)}
                    r="4"
                    fill={t.color}
                    stroke="#fff"
                    strokeOpacity="0.5"
                  />
                </g>
              ))}
            {t.decorations.includes("Pearls") &&
              Array.from({ length: 19 }, (_, n) => (
                <circle
                  key={n}
                  cx={220 - t.w + 8 + (n * (t.w * 2 - 16)) / 18}
                  cy={t.bottom + ellipse * Math.sin((n / 18) * Math.PI) - 3}
                  r="3"
                  fill={`url(#gold-${id})`}
                />
              ))}
            {t.decorations.includes("Gold accents") &&
              Array.from({ length: 16 }, (_, n) => (
                <path
                  key={n}
                  d="M-2 -3L3 -1L1 3L-2 1Z"
                  fill={`url(#gold-${id})`}
                  transform={`translate(${220 - t.w + 13 + ((n * 47) % (t.w * 2 - 26))},${t.top + 10 + ((n * 31) % Math.max(20, t.h - 14))}) rotate(${n * 41})`}
                />
              ))}
            {t.decorations.includes("Sprinkles") &&
              Array.from({ length: 45 }, (_, n) => (
                <rect
                  key={n}
                  x={220 - t.w + 10 + ((n * 41) % (t.w * 2 - 20))}
                  y={t.top + 15 + ((n * 19) % Math.max(20, t.h - 15))}
                  width="2"
                  height="5"
                  rx="1"
                  fill={
                    ["#cd829b", "#96b1ca", "#dec374", "#a8bc8b", "#b197c4"][
                      n % 5
                    ]
                  }
                  transform={`rotate(${n * 31} ${220 - t.w + 10 + ((n * 41) % (t.w * 2 - 20))} ${t.top + 15 + ((n * 19) % Math.max(20, t.h - 15))})`}
                />
              ))}
            {(t.decorations.includes("Roses") ||
              t.decorations.includes("Flowers")) &&
              [
                [-t.w * 0.72, 5, 16],
                [t.w * 0.72, -3, 13],
                [t.w * 0.53, 10, 9],
              ].map(([x, dy, r], n) => (
                <g key={n} transform={`translate(${220 + x},${t.top + dy})`}>
                  <ellipse
                    cx={-r}
                    cy="7"
                    rx="12"
                    ry="4"
                    fill="#92a389"
                    transform="rotate(-26)"
                  />
                  <ellipse
                    cx={r}
                    cy="10"
                    rx="10"
                    ry="4"
                    fill="#a6b198"
                    transform="rotate(25)"
                  />
                  {Array.from({ length: 7 }, (_, p) => (
                    <ellipse
                      key={p}
                      cx={Math.cos((p / 7) * Math.PI * 2) * r * 0.48}
                      cy={Math.sin((p / 7) * Math.PI * 2) * r * 0.48}
                      rx={r * 0.72}
                      ry={r * 0.55}
                      transform={`rotate(${(p / 7) * 360} ${Math.cos((p / 7) * Math.PI * 2) * r * 0.48} ${Math.sin((p / 7) * Math.PI * 2) * r * 0.48})`}
                      fill={
                        t.decorations.includes("Roses")
                          ? ["#e9b3bf", "#f3cad0", "#f7dbdd"][p % 3]
                          : "#fff9ec"
                      }
                      stroke={
                        t.decorations.includes("Roses") ? "#d8a0af" : "#e9dfc9"
                      }
                      strokeWidth="0.6"
                    />
                  ))}
                  <circle
                    r={r * 0.4}
                    fill={
                      t.decorations.includes("Roses") ? "#d29aa9" : "#d6ba69"
                    }
                  />
                  {t.decorations.includes("Roses") && (
                    <path
                      d={`M-3 3Q-9 -5 0 -6Q8 -4 3 2Q-3 6 -3 0Q0 -3 2 0`}
                      fill="none"
                      stroke="#f7dce0"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              ))}
            {t.decorations.includes("Macarons") &&
              [-0.5, 0.2, 0.6].map((x, n) => (
                <g
                  key={n}
                  transform={`translate(${220 + t.w * x},${t.top - 6}) rotate(${n * 18 - 15})`}
                >
                  <rect
                    x="-12"
                    y="-13"
                    width="24"
                    height="23"
                    rx="11"
                    fill={["#d0b1c2", "#c5ceab", "#e4b4a6"][n]}
                  />
                  <path d="M-11 -1H11" stroke="#fff5e5" strokeWidth="3" />
                </g>
              ))}
            {t.decorations.includes("Fruit") &&
              [-0.6, -0.2, 0.2, 0.6].map((x, n) => (
                <g
                  key={n}
                  transform={`translate(${220 + t.w * x},${t.top - 4})`}
                >
                  <path
                    d="M-10 0Q-12 -17 0 -17Q12 -17 10 0L0 10Z"
                    fill="#bd4f50"
                  />
                  <path d="M-8 -14L0 -22L7 -14L0 -16Z" fill="#819a6b" />
                  <circle cx="-3" cy="-5" r="1" fill="#f6d396" />
                  <circle cx="4" cy="0" r="1" fill="#f6d396" />
                </g>
              ))}
            {t.decorations.includes("Chocolate") &&
              [-0.6, -0.1, 0.4].map((x, n) => (
                <rect
                  key={n}
                  x={220 + t.w * x}
                  y={t.top - 26}
                  width="14"
                  height="31"
                  rx="2"
                  fill="#503228"
                  transform={`rotate(${n * 25 - 18} ${220 + t.w * x} ${t.top})`}
                />
              ))}
            {t.decorations.includes("Ribbons") && (
              <>
                <path
                  d={`M${220 - t.w} ${t.bottom - 12}Q220 ${t.bottom + ellipse * 1.4 - 12} ${220 + t.w} ${t.bottom - 12}`}
                  fill="none"
                  stroke="#bf8a9e"
                  strokeWidth="8"
                />
                <path
                  d={`M220 ${t.bottom}q-32 -22 -30 -4q3 12 30 4q30 -20 28 -4q-3 10 -28 4`}
                  fill="#d8a7b5"
                  stroke="#bb8899"
                />
              </>
            )}
            {t.decorations.includes("Characters") && (
              <g transform={`translate(220 ${t.top - 12})`}>
                <circle cx="-10" cy="-13" r="7" fill="#e1c7a7" />
                <circle cx="10" cy="-13" r="7" fill="#e1c7a7" />
                <circle cy="-3" r="16" fill="#e8d5bd" />
                <circle cx="-5" cy="-5" r="1.5" fill="#5a4541" />
                <circle cx="5" cy="-5" r="1.5" fill="#5a4541" />
                <ellipse cy="2" rx="5" ry="4" fill="#f8ead8" />
                <circle cy="0" r="2" fill="#755b4c" />
              </g>
            )}
            {t.decorations.includes("Leaves") &&
              Array.from({ length: 6 }, (_, n) => (
                <ellipse
                  key={n}
                  cx={220 - t.w + 15 + n * 14}
                  cy={t.top + 4}
                  rx="11"
                  ry="4"
                  fill={n % 2 ? "#899f7c" : "#a4b096"}
                  transform={`rotate(${n % 2 ? 30 : -30} ${220 - t.w + 15 + n * 14} ${t.top + 4})`}
                />
              ))}
            {selected === t.id && (
              <path
                d={`M${220 - t.w - 4} ${t.top}L${220 - t.w - 4} ${t.bottom}Q220 ${t.bottom + ellipse * 2 + 6} ${220 + t.w + 4} ${t.bottom}V${t.top}`}
                fill="none"
                stroke="#8c709a"
                strokeWidth="1.8"
                strokeDasharray="5 4"
              />
            )}
          </g>
        );
      })}
      {config.topper && (
        <g onClick={() => onSelect?.("topper")}>
          <path
            d={`M207 ${top.top - 10}V${top.top - 52}M233 ${top.top - 10}V${top.top - 52}`}
            stroke="#b89958"
            strokeWidth="2"
          />
          <text
            x="220"
            y={top.top - 56}
            textAnchor="middle"
            fontFamily="Georgia,serif"
            fontStyle="italic"
            fontSize="17"
            fill={`url(#gold-${id})`}
          >
            {config.topper}
          </text>
        </g>
      )}
      {config.text && (
        <text
          x="220"
          y={tiers[0].top + tiers[0].h * 0.65}
          textAnchor="middle"
          fontSize={Math.min(
            config.textSize,
            config.text.length > 25 ? 14 : 19,
          )}
          fill={config.textColor}
          fontFamily={
            config.textStyle === "Modern"
              ? "sans-serif"
              : config.textStyle === "Playful"
                ? "cursive"
                : "Georgia,serif"
          }
          fontStyle={config.textStyle === "Elegant" ? "italic" : undefined}
          onClick={() => onSelect?.("text")}
        >
          {config.text}
        </text>
      )}
    </svg>
  );
}
