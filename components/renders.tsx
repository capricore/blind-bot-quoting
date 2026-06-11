import type { OpacityId, PatternStyle, ProductColor } from "@/lib/types";

/**
 * Programmatic in-context renders. These stand in for the production render
 * engine: every configurator change (pattern, color, opacity, dimensions,
 * options) re-renders the scene instantly.
 */

const FABRIC_OPACITY: Record<OpacityId, number> = {
  sheer: 0.5,
  "light-filtering": 0.85,
  "room-darkening": 0.96,
  blackout: 1,
};

// Deterministic ids keep server and client markup identical; duplicate defs
// with the same id render identically, so collisions are harmless.
const patternId = (style: PatternStyle, color: ProductColor) =>
  `pat-${style}-${color.id}-${color.hex.slice(1)}`;

function PatternDefs({
  id,
  style,
  color,
}: {
  id: string;
  style: PatternStyle;
  color: ProductColor;
}) {
  const accent = color.accentHex ?? shade(color.hex, -14);
  switch (style) {
    case "linen":
      return (
        <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill={color.hex} />
          <path d="M0 3.5h7" stroke={accent} strokeWidth="0.8" opacity="0.5" />
          <path d="M3.5 0v7" stroke={accent} strokeWidth="0.5" opacity="0.35" />
        </pattern>
      );
    case "stripe":
      return (
        <pattern id={id} width="34" height="10" patternUnits="userSpaceOnUse">
          <rect width="34" height="10" fill={color.hex} />
          <rect x="20" width="9" height="10" fill={accent} opacity="0.85" />
        </pattern>
      );
    case "screen":
      return (
        <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill={color.hex} opacity="0.9" />
          <circle cx="2" cy="2" r="0.7" fill="#ffffff" opacity="0.55" />
        </pattern>
      );
    case "botanical":
      return (
        <pattern id={id} width="46" height="52" patternUnits="userSpaceOnUse">
          <rect width="46" height="52" fill={color.hex} />
          <g fill="none" stroke={accent} strokeWidth="1.4" opacity="0.8">
            <path d="M12 44 C10 32 16 24 14 12" />
            <path d="M14 30 C8 28 5 22 6 16" />
            <path d="M14 30 C20 28 23 22 22 16" />
            <path d="M36 50 C38 40 33 34 35 24" />
            <path d="M35 36 C30 34 28 29 29 24" />
          </g>
        </pattern>
      );
    case "geo":
      return (
        <pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill={color.hex} />
          <path
            d="M13 2 L24 13 L13 24 L2 13 Z"
            fill="none"
            stroke={accent}
            strokeWidth="1.3"
            opacity="0.7"
          />
          <circle cx="13" cy="13" r="1.4" fill={accent} opacity="0.6" />
        </pattern>
      );
    case "velvet":
      return (
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(color.hex, 14)} />
          <stop offset="0.45" stopColor={color.hex} />
          <stop offset="0.65" stopColor={shade(color.hex, -12)} />
          <stop offset="1" stopColor={shade(color.hex, 6)} />
        </linearGradient>
      );
    case "voile":
      return (
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={color.hex} opacity="0.7" />
        </pattern>
      );
    case "weave":
      return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={color.hex} />
          <path d="M0 2h8M0 6h8" stroke={shade(color.hex, -12)} strokeWidth="1.1" opacity="0.55" />
          <path d="M2 0v8M6 0v8" stroke={color.accentHex ?? shade(color.hex, -8)} strokeWidth="1.1" opacity="0.4" />
        </pattern>
      );
    case "solid":
    default:
      return (
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color.hex, 5)} />
          <stop offset="1" stopColor={shade(color.hex, -5)} />
        </linearGradient>
      );
  }
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function Room({
  w,
  h,
  children,
}: {
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  const floorY = h - 64;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EFEBE3" />
          <stop offset="1" stopColor="#E4DFD4" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9B391" />
          <stop offset="1" stopColor="#B49C79" />
        </linearGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#BBD4E4" />
          <stop offset="0.6" stopColor="#DCE9F0" />
          <stop offset="1" stopColor="#F2EFE2" />
        </linearGradient>
      </defs>
      <rect width={w} height={floorY} fill="url(#wall)" />
      <rect y={floorY} width={w} height={h - floorY} fill="url(#floor)" />
      {/* floor boards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <path
          key={i}
          d={`M0 ${floorY + 12 + i * 12} H${w}`}
          stroke="#A78D69"
          strokeWidth="1"
          opacity="0.35"
        />
      ))}
      <rect y={floorY - 7} width={w} height={7} fill="#F4F1E9" />
      {children}
      {/* potted plant, foreground left */}
      <g opacity="0.92">
        <ellipse cx="64" cy={h - 14} rx="34" ry="6" fill="#000" opacity="0.08" />
        <path d={`M50 ${h - 58} h28 l-4 44 h-20 Z`} fill="#9C7B5B" />
        <g stroke="#6E8B68" strokeWidth="5" fill="none" strokeLinecap="round">
          <path d={`M64 ${h - 58} C58 ${h - 92} 42 ${h - 100} 34 ${h - 122}`} />
          <path d={`M64 ${h - 58} C66 ${h - 96} 80 ${h - 104} 88 ${h - 124}`} />
          <path d={`M64 ${h - 58} C62 ${h - 88} 60 ${h - 110} 62 ${h - 132}`} />
        </g>
      </g>
    </svg>
  );
}

function WindowFrame({
  x,
  y,
  w,
  h,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const inset = 9;
  return (
    <g>
      <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx="3" fill="#FBFAF6" />
      <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx="3" fill="none" stroke="#D8D2C4" strokeWidth="1.5" />
      <rect x={x} y={y} width={w} height={h} fill="url(#sky)" />
      {/* distant skyline */}
      <g opacity="0.5" fill="#A9BFCC">
        <rect x={x + w * 0.12} y={y + h * 0.52} width={w * 0.1} height={h * 0.48} />
        <rect x={x + w * 0.26} y={y + h * 0.42} width={w * 0.13} height={h * 0.58} />
        <rect x={x + w * 0.45} y={y + h * 0.58} width={w * 0.09} height={h * 0.42} />
        <rect x={x + w * 0.6} y={y + h * 0.46} width={w * 0.14} height={h * 0.54} />
        <rect x={x + w * 0.8} y={y + h * 0.55} width={w * 0.1} height={h * 0.45} />
      </g>
      <circle cx={x + w * 0.78} cy={y + h * 0.2} r={Math.min(w, h) * 0.07} fill="#F6E7B2" opacity="0.9" />
      {/* mullions */}
      <path d={`M${x + w / 2} ${y} V${y + h}`} stroke="#FBFAF6" strokeWidth={inset / 2} />
      <path d={`M${x} ${y + h / 2} H${x + w}`} stroke="#FBFAF6" strokeWidth={inset / 2} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#E5E0D2" strokeWidth="2" />
      {/* sill */}
      <rect x={x - 14} y={y + h + 6} width={w + 28} height={8} rx="2" fill="#F4F1E9" />
      <rect x={x - 14} y={y + h + 14} width={w + 28} height={3} fill="#00000014" />
    </g>
  );
}

export interface RollerSceneProps {
  color: ProductColor;
  patternStyle: PatternStyle;
  opacityId: OpacityId;
  widthCm: number;
  heightCm: number;
  mount: string;
  headrail: string;
  control: string;
  /** 0–1, how far the shade is lowered in the preview */
  drop?: number;
}

export function RollerShadeScene({
  color,
  patternStyle,
  opacityId,
  widthCm,
  heightCm,
  mount,
  headrail,
  control,
  drop = 0.7,
}: RollerSceneProps) {
  const W = 560;
  const H = 420;
  const patId = patternId(patternStyle, color);

  // scale the assembly to fit the stage
  const maxW = 330;
  const maxH = 250;
  const scale = Math.min(maxW / widthCm, maxH / heightCm);
  const shadeW = widthCm * scale;
  const shadeH = heightCm * scale;
  const cx = W / 2 + 20;
  const topY = 78;

  const inside = mount === "inside";
  const winW = inside ? shadeW + 18 : Math.max(60, shadeW - 26);
  const winH = inside ? shadeH + 14 : Math.max(60, shadeH - 22);
  const winX = cx - winW / 2;
  const winY = inside ? topY - 7 : topY + 11;

  const fabricX = cx - shadeW / 2;
  const fabricTop = topY + 14;
  const fabricLen = Math.max(10, (shadeH - 14) * drop);
  const cassette = headrail === "cassette";

  return (
    <Room w={W} h={H}>
      <WindowFrame x={winX} y={winY} w={winW} h={winH} />
      <defs>
        <PatternDefs id={patId} style={patternStyle} color={color} />
        <linearGradient id={`${patId}-roll`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color.hex, 22)} />
          <stop offset="0.5" stopColor={shade(color.hex, -8)} />
          <stop offset="1" stopColor={shade(color.hex, 10)} />
        </linearGradient>
      </defs>
      {/* fabric panel */}
      <g>
        <rect
          x={fabricX}
          y={fabricTop}
          width={shadeW}
          height={fabricLen}
          fill={`url(#${patId})`}
          opacity={FABRIC_OPACITY[opacityId]}
        />
        {/* side light-gaps for blackout realism */}
        {opacityId === "blackout" && (
          <rect x={fabricX} y={fabricTop} width={shadeW} height={fabricLen} fill="#000" opacity="0.06" />
        )}
        {/* soft inner shadow at the bottom of the fabric */}
        <rect
          x={fabricX}
          y={fabricTop + fabricLen - 12}
          width={shadeW}
          height={12}
          fill="#000"
          opacity="0.07"
        />
        {/* bottom bar */}
        <rect
          x={fabricX - 2}
          y={fabricTop + fabricLen}
          width={shadeW + 4}
          height={8}
          rx="3.5"
          fill={shade(color.hex, -28)}
        />
        {/* headrail */}
        {cassette ? (
          <rect x={fabricX - 5} y={topY} width={shadeW + 10} height={16} rx="5" fill={`url(#${patId}-roll)`} />
        ) : (
          <g>
            <rect x={fabricX} y={topY + 2} width={shadeW} height={13} rx="6.5" fill={`url(#${patId}-roll)`} />
            <circle cx={fabricX + 4} cy={topY + 8.5} r="3" fill="#8C8C8C" />
            <circle cx={fabricX + shadeW - 4} cy={topY + 8.5} r="3" fill="#8C8C8C" />
          </g>
        )}
        {/* control: chain or motor indicator */}
        {control.startsWith("chain") ? (
          <g>
            <path
              d={`M${fabricX + shadeW + 8} ${topY + 12} v${Math.min(150, fabricLen + 40)}`}
              stroke={control === "chain-metal" ? "#9FA4AA" : "#D9D6CE"}
              strokeWidth="2.5"
              strokeDasharray="1.5 4"
              strokeLinecap="round"
            />
            <circle
              cx={fabricX + shadeW + 8}
              cy={topY + 14 + Math.min(150, fabricLen + 40)}
              r="4"
              fill={control === "chain-metal" ? "#9FA4AA" : "#D9D6CE"}
            />
          </g>
        ) : (
          <g>
            <rect x={fabricX + shadeW - 26} y={topY + 3.5} width={22} height={9} rx="4.5" fill="#2E3440" opacity="0.85" />
            <circle cx={fabricX + shadeW - 9} cy={topY + 8} r="2" fill="#7CE38B" />
          </g>
        )}
      </g>
    </Room>
  );
}

export interface DraperySceneProps {
  color: ProductColor;
  patternStyle: PatternStyle;
  opacityId: OpacityId;
  rodWidthCm: number;
  heightCm: number;
  panels: string;
  fullness: string;
  header: string;
  /** 0 = fully closed, 1 = fully open */
  openAmount?: number;
}

export function DraperyScene({
  color,
  patternStyle,
  opacityId,
  rodWidthCm,
  heightCm,
  panels,
  fullness,
  header,
  openAmount = 0.45,
}: DraperySceneProps) {
  const W = 560;
  const H = 420;
  const patId = patternId(patternStyle, color);

  const maxW = 380;
  const maxH = 270;
  const scale = Math.min(maxW / rodWidthCm, maxH / heightCm);
  const rodW = rodWidthCm * scale;
  const dropH = heightCm * scale;
  const cx = W / 2 + 20;
  const rodY = 70;
  const rodX = cx - rodW / 2;

  const winW = rodW * 0.74;
  const winH = dropH * 0.82;
  const winX = cx - winW / 2;
  const winY = rodY + 26;

  const fullnessN = parseFloat(fullness) || 2.0;
  const pair = panels === "pair";
  // closed coverage fraction of the rod per stack
  const coverage = pair ? (1 - openAmount * 0.75) / 2 : 1 - openAmount * 0.75;
  const stackW = Math.max(rodW * 0.09, rodW * coverage);
  const waveCount = Math.max(3, Math.round((stackW / 26) * (fullnessN / 2)));

  const fabricTop = header === "grommet" ? rodY + 6 : rodY + 10;
  const fabricH = dropH - (fabricTop - rodY);

  const panelPath = (x0: number, w: number) => {
    const n = waveCount;
    const seg = w / n;
    const depth = Math.min(13, 6 + fullnessN * 2.4);
    let d = `M${x0} ${fabricTop}`;
    for (let i = 0; i < n; i++) {
      const x1 = x0 + seg * (i + 0.5);
      const x2 = x0 + seg * (i + 1);
      d += ` Q${x1} ${fabricTop + (i % 2 === 0 ? depth : -depth * 0.4)} ${x2} ${fabricTop}`;
    }
    d += ` L${x0 + w} ${fabricTop + fabricH}`;
    for (let i = waveCount; i > 0; i--) {
      const x1 = x0 + seg * (i - 0.5);
      const x2 = x0 + seg * (i - 1);
      d += ` Q${x1} ${fabricTop + fabricH + (i % 2 === 0 ? depth * 1.4 : -depth * 0.5)} ${x2} ${fabricTop + fabricH}`;
    }
    d += " Z";
    return d;
  };

  const folds = (x0: number, w: number) =>
    Array.from({ length: waveCount - 1 }).map((_, i) => {
      const fx = x0 + (w / waveCount) * (i + 1);
      return (
        <path
          key={i}
          d={`M${fx} ${fabricTop + 4} C${fx + 3} ${fabricTop + fabricH * 0.3} ${fx - 3} ${fabricTop + fabricH * 0.7} ${fx} ${fabricTop + fabricH - 6}`}
          stroke="#000"
          strokeWidth={1.1}
          opacity="0.10"
          fill="none"
        />
      );
    });

  const fabOpacity = FABRIC_OPACITY[opacityId];

  return (
    <Room w={W} h={H}>
      <WindowFrame x={winX} y={winY} w={winW} h={winH} />
      <defs>
        <PatternDefs id={patId} style={patternStyle} color={color} />
      </defs>

      {/* panels */}
      {pair ? (
        <g>
          <path d={panelPath(rodX + 3, stackW)} fill={`url(#${patId})`} opacity={fabOpacity} />
          {folds(rodX + 3, stackW)}
          <path d={panelPath(rodX + rodW - stackW - 3, stackW)} fill={`url(#${patId})`} opacity={fabOpacity} />
          {folds(rodX + rodW - stackW - 3, stackW)}
        </g>
      ) : (
        <g>
          <path d={panelPath(rodX + 3, stackW)} fill={`url(#${patId})`} opacity={fabOpacity} />
          {folds(rodX + 3, stackW)}
        </g>
      )}

      {/* rod or track above panels */}
      {header === "ripple-fold" ? (
        <rect x={rodX - 10} y={rodY} width={rodW + 20} height={7} rx="3" fill="#3D434D" />
      ) : (
        <g>
          <rect x={rodX - 10} y={rodY + 2} width={rodW + 20} height={5} rx="2.5" fill="#6B5B45" />
          <circle cx={rodX - 14} cy={rodY + 4.5} r="6" fill="#5C4D39" />
          <circle cx={rodX + rodW + 14} cy={rodY + 4.5} r="6" fill="#5C4D39" />
          {header === "grommet" &&
            Array.from({ length: waveCount }).map((_, i) => (
              <circle
                key={i}
                cx={rodX + 8 + (stackW / waveCount) * (i + 0.3)}
                cy={rodY + 4.5}
                r="2.6"
                fill="#C8B68E"
              />
            ))}
        </g>
      )}
    </Room>
  );
}

/** Small fabric swatch used on catalog cards and quote lines. */
export function Swatch({
  color,
  patternStyle,
  size = 56,
  rounded = 12,
}: {
  color: ProductColor;
  patternStyle: PatternStyle;
  size?: number;
  rounded?: number;
}) {
  const patId = patternId(patternStyle, color);
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" className="shrink-0">
      <defs>
        <PatternDefs id={patId} style={patternStyle} color={color} />
      </defs>
      <rect width="56" height="56" rx={rounded} fill={`url(#${patId})`} />
      <rect width="56" height="56" rx={rounded} fill="none" stroke="#00000018" strokeWidth="1" />
    </svg>
  );
}
