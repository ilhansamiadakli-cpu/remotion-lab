import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, useActiveTheme } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface RayCastConeSimProps {
  /** Üst monospace kategori etiketi */
  eyebrow?: string;
  /** Ana başlık */
  title?: string;
  /** Sağ üst rozet */
  badge?: string;
  /** Kamera görüş açısı genişliği (derece, varsayılan: 68) */
  fovDeg?: number;
  /** Atılacak vektörel ışın sayısı (varsayılan: 26 — yüksek FPS) */
  rayCount?: number;
  /** Taramanın başlangıç açısı (derece, varsayılan: -155) */
  sweepStartDeg?: number;
  /** Taramanın bitiş açısı (derece, varsayılan: 30) */
  sweepEndDeg?: number;
  /** Sağ tarafta gerçek zamanlı aktifleşen BSP/PVS ağaç paneli gösterilsin mi? (varsayılan: true) */
  showBspTree?: boolean;
  /** Alt teknik özet notu */
  caption?: string;
  /** `SplitStage` içine gömüldüğünde `<AbsoluteFill>` sarmalayıcısını kaldırır */
  embedded?: boolean;
  /** TimelineRenderer tarafından geçirilen sahne süresi (kare) */
  beatDurationInFrames?: number;
  startFrame?: number;
}

interface Seg2D {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface RoomDef {
  id: string;
  leaf: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// 560x400 üstten görünümlü oda/koridor haritası + duvar segmentleri
const ROOMS: RoomDef[] = [
  { id: "R0", leaf: "S1", x: 30, y: 30, w: 150, h: 145 },
  { id: "R1", leaf: "S2", x: 205, y: 30, w: 150, h: 145 },
  { id: "R2", leaf: "S3", x: 380, y: 30, w: 150, h: 145 },
  { id: "R3", leaf: "S4", x: 30, y: 225, w: 150, h: 145 },
  { id: "R4", leaf: "S5", x: 205, y: 225, w: 150, h: 145 },
  { id: "R5", leaf: "S6", x: 380, y: 225, w: 150, h: 145 },
];

// Duvarlar (R1 <-> R0, R1 <-> R2 ve R1 <-> R4 kapıları açık; R3 ve R5 kalın köşe duvarlarıyla gizli)
const WALL_SEGMENTS: Seg2D[] = [
  // Dış sınır
  { x1: 30, y1: 30, x2: 530, y2: 30 },
  { x1: 530, y1: 30, x2: 530, y2: 370 },
  { x1: 530, y1: 370, x2: 30, y2: 370 },
  { x1: 30, y1: 370, x2: 30, y2: 30 },
  // R0-R1 arası dikey duvar (ortada 75..130 açık portal)
  { x1: 192, y1: 30, x2: 192, y2: 75 },
  { x1: 192, y1: 130, x2: 192, y2: 195 },
  // R1-R2 arası dikey duvar (ortada 75..130 açık portal)
  { x1: 368, y1: 30, x2: 368, y2: 75 },
  { x1: 368, y1: 130, x2: 368, y2: 195 },
  // Üst-alt yatay bölücü duvarlar (R1-R4 arasında 252..308 açık portal)
  { x1: 30, y1: 195, x2: 252, y2: 195 },
  { x1: 308, y1: 195, x2: 530, y2: 195 },
  // Alt kat oda bölücüleri
  { x1: 192, y1: 195, x2: 192, y2: 370 },
  { x1: 368, y1: 195, x2: 368, y2: 370 },
];

const PLAYER = { x: 280, y: 102 };

function castRay(ox: number, oy: number, rad: number): { x: number; y: number; dist: number } {
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  let bestT = 520;

  for (const s of WALL_SEGMENTS) {
    const sx = s.x2 - s.x1;
    const sy = s.y2 - s.y1;
    const denom = dx * sy - dy * sx;
    if (Math.abs(denom) < 1e-6) continue;
    const qpx = s.x1 - ox;
    const qpy = s.y1 - oy;
    const t = (qpx * sy - qpy * sx) / denom;
    const u = (qpx * dy - qpy * dx) / denom;
    if (t > 0.5 && t < bestT && u >= -0.001 && u <= 1.001) {
      bestT = t;
    }
  }

  return { x: ox + dx * bestT, y: oy + dy * bestT, dist: bestT };
}

function pointInRoom(px: number, py: number, room: RoomDef): boolean {
  return px >= room.x - 14 && px <= room.x + room.w + 14 && py >= room.y - 14 && py <= room.y + room.h + 14;
}

/**
 * RayCastConeSim (v3.0 Prosedürel SVG Simülasyonu)
 * `useCurrentFrame()` ile dönen kamera görüş konisini (FOV), gerçek 2D ışın-duvar
 * kesişimlerini ve anlık aktifleşen BSP/PVS düğümlerini vektörel olarak hesaplar.
 */
export const RayCastConeSim: React.FC<RayCastConeSimProps> = ({
  eyebrow = "CANLI RAYCAST & PVS SİMÜLASYONU",
  title = "Dönen Görüş Konisi ve BSP / PVS Elemesi",
  badge = "REAL-TIME SVG",
  fovDeg = 68,
  rayCount = 26,
  sweepStartDeg = -170,
  sweepEndDeg = 135,
  showBspTree = true,
  caption,
  embedded = false,
  beatDurationInFrames = 135,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useActiveTheme();

  const localFrame = Math.max(0, frame - startFrame);
  const entrance = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  // Kamera açısı sahne boyunca pürüzsüz sinüzoidal süpürme yapar
  const sweepT = interpolate(localFrame, [0, Math.max(1, beatDurationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
  const centerAngleDeg = interpolate(sweepT, [0, 1], [sweepStartDeg, sweepEndDeg]);
  const halfFov = fovDeg / 2;

  const rays = React.useMemo(() => {
    const out: Array<{ x: number; y: number; dist: number; angleDeg: number }> = [];
    const n = Math.max(8, Math.min(48, rayCount));
    for (let i = 0; i < n; i++) {
      const aDeg = centerAngleDeg - halfFov + (i / (n - 1)) * fovDeg;
      const hit = castRay(PLAYER.x, PLAYER.y, (aDeg * Math.PI) / 180);
      out.push({ ...hit, angleDeg: aDeg });
    }
    return out;
  }, [centerAngleDeg, fovDeg, halfFov, rayCount]);

  // Hangi odalar şu an aktif görüş konisi tarafından görülüyor?
  const visibleRooms = new Set<string>(["R1"]);
  for (const r of rays) {
    // Işın boyunca orta ve uç noktaları oda kontrolüne sok
    for (const frac of [0.55, 0.92, 0.99]) {
      const sx = PLAYER.x + (r.x - PLAYER.x) * frac;
      const sy = PLAYER.y + (r.y - PLAYER.y) * frac;
      for (const room of ROOMS) {
        if (pointInRoom(sx, sy, room)) {
          visibleRooms.add(room.id);
        }
      }
    }
  }

  const conePolygonPoints = [
    `${PLAYER.x},${PLAYER.y}`,
    ...rays.map((r) => `${r.x.toFixed(1)},${r.y.toFixed(1)}`),
  ].join(" ");

  const visibleCount = visibleRooms.size;
  const culledCount = ROOMS.length - visibleCount;

  // Sağ BSP ağacı düğüm durumları
  const leftBranchActive = visibleRooms.has("R0") || visibleRooms.has("R3");
  const rightBranchActive = visibleRooms.has("R2") || visibleRooms.has("R4") || visibleRooms.has("R5");

  const card = (
    <div
      className="relative flex w-full flex-col"
      style={{
        maxWidth: embedded ? undefined : 1340,
        background: COLORS.glassBg,
        backdropFilter: GLASS_TOKENS.blur,
        WebkitBackdropFilter: GLASS_TOKENS.blur,
        border: COLORS.border,
        borderRadius: GLASS_TOKENS.borderRadius,
        boxShadow: theme.isLight
          ? `0 24px 60px rgba(17, 24, 39, 0.12), inset 0 1px 0 ${COLORS.borderHighlight}`
          : `0 34px 86px rgba(0, 0, 0, 0.78), inset 0 1px 0 ${COLORS.borderHighlight}`,
        padding: embedded ? "20px 22px" : "28px 34px",
        opacity: interpolate(entrance, [0, 0.55], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translate3d(0, ${interpolate(entrance, [0, 1], [22, 0])}px, 0) scale(${interpolate(entrance, [0, 1], [0.97, 1])})`,
      }}
    >
      <CadCorners size={13} accent startFrame={startFrame} />
      <SpecularSweep startFrame={startFrame} />

      {/* Üst başlık ve canlı telemetri */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          {eyebrow && (
            <div className="flex items-center gap-2">
              <span style={{ width: 6, height: 6, background: COLORS.accent }} />
              <span
                className="uppercase tracking-[0.18em]"
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.accent,
                }}
              >
                {eyebrow}
              </span>
            </div>
          )}
          <h2
            className="m-0"
            style={{
              fontFamily: FONTS.sans,
              fontSize: embedded ? 24 : 30,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: COLORS.textPrimary,
            }}
          >
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2.5" style={{ fontFamily: FONTS.mono, fontVariantNumeric: "tabular-nums" }}>
          <span
            className="px-3 py-1.5"
            style={{
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.accentBright,
              background: COLORS.accentSoft,
              border: `1px solid ${COLORS.accentBorder}`,
            }}
          >
            {`FOV ${Math.round(((centerAngleDeg % 360) + 360) % 360)}° · GÖRÜNÜR ${visibleCount}/6`}
          </span>
          <span
            className="px-3 py-1.5"
            style={{
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.danger,
              background: COLORS.dangerSoft,
              border: `1px solid ${COLORS.dangerBorder}`,
            }}
          >
            {`ELENDİ: ${culledCount}`}
          </span>
          {badge && (
            <span
              className="px-2.5 py-1.5 uppercase"
              style={{
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                color: COLORS.textSecondary,
                background: COLORS.surfaceSubtle,
                border: COLORS.border,
              }}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Ana 2 sütunlu vektörel sahne: Sol harita + Sağ canlı BSP/PVS ağacı */}
      <div className="flex items-stretch gap-6">
        {/* SOL: Üstten Harita + Dönen Raycast Konisi */}
        <div
          className="relative flex-1 overflow-hidden p-4"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: COLORS.canvasDeep,
            border: COLORS.border,
          }}
        >
          <svg viewBox="0 0 560 400" style={{ width: "100%", height: "auto", display: "block" }}>
            {/* Odalar */}
            {ROOMS.map((room) => {
              const isVis = visibleRooms.has(room.id);
              const isPlayerRoom = room.id === "R1";
              return (
                <g key={room.id}>
                  <rect
                    x={room.x}
                    y={room.y}
                    width={room.w}
                    height={room.h}
                    rx={6}
                    fill={
                      isPlayerRoom
                        ? `rgba(${theme.colors.accentRgb}, 0.14)`
                        : isVis
                          ? `rgba(${theme.colors.accentRgb}, 0.08)`
                          : theme.colors.surfaceSubtle
                    }
                    stroke={isVis ? theme.colors.accentBorder : theme.colors.borderColor}
                    strokeWidth={isVis ? 1.5 : 1}
                  />
                  <text
                    x={room.x + 12}
                    y={room.y + 24}
                    fill={isVis ? theme.colors.accentBright : theme.colors.textMuted}
                    fontFamily={FONTS.mono}
                    fontSize={13}
                    fontWeight={600}
                  >
                    {`${room.id} · ${room.leaf}`}
                  </text>
                  <text
                    x={room.x + room.w - 12}
                    y={room.y + room.h - 12}
                    textAnchor="end"
                    fill={isVis ? theme.colors.success : theme.colors.danger}
                    fontFamily={FONTS.mono}
                    fontSize={10.5}
                    fontWeight={600}
                  >
                    {isVis ? "PVS = 1" : "CULLED · 0"}
                  </text>
                </g>
              );
            })}

            {/* Dönen Görüş Konisi Dolgusu */}
            <polygon
              points={conePolygonPoints}
              fill={`rgba(${theme.colors.accentRgb}, 0.20)`}
              stroke={theme.colors.accent}
              strokeOpacity={0.55}
              strokeWidth={1.2}
            />

            {/* Tekil Işın Çizgileri */}
            {rays.map((r, i) => (
              <g key={`ray-${i}`}>
                <line
                  x1={PLAYER.x}
                  y1={PLAYER.y}
                  x2={r.x}
                  y2={r.y}
                  stroke={theme.colors.accentBright}
                  strokeOpacity={i % 3 === 0 ? 0.55 : 0.22}
                  strokeWidth={i % 3 === 0 ? 1.15 : 0.7}
                />
                {i % 2 === 0 && (
                  <circle cx={r.x} cy={r.y} r={2.2} fill={theme.colors.accentBright} opacity={0.85} />
                )}
              </g>
            ))}

            {/* Duvar Segmentleri */}
            {WALL_SEGMENTS.map((s, idx) => (
              <line
                key={`wall-${idx}`}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={theme.colors.textPrimary}
                strokeWidth={3.2}
                strokeLinecap="round"
              />
            ))}

            {/* Oyuncu Kamerası */}
            <circle
              cx={PLAYER.x}
              cy={PLAYER.y}
              r={14}
              fill={`rgba(${theme.colors.accentRgb}, 0.25)`}
            />
            <circle
              cx={PLAYER.x}
              cy={PLAYER.y}
              r={6.5}
              fill={theme.colors.accent}
              stroke={theme.colors.textBright}
              strokeWidth={2}
            />
          </svg>
        </div>

        {/* SAĞ: Gerçek Zamanlı Aktifleşen BSP / PVS Ağacı */}
        {showBspTree && (
          <div
            className="flex flex-col justify-between p-4"
            style={{
              width: embedded ? 340 : 450,
              borderRadius: GLASS_TOKENS.borderRadiusSm,
              background: COLORS.canvasDeep,
              border: COLORS.border,
            }}
          >
            <div
              className="mb-2 uppercase tracking-[0.14em]"
              style={{ fontFamily: FONTS.mono, fontSize: 11.5, color: COLORS.accent, fontWeight: 600 }}
            >
              CANLI BSP / PVS DÜĞÜM DURUMU
            </div>

            <svg viewBox="0 0 420 275" style={{ width: "100%", height: "auto", display: "block" }}>
              {/* Ağaç bağlantıları */}
              <line
                x1={210}
                y1={46}
                x2={110}
                y2={112}
                stroke={leftBranchActive ? theme.colors.accent : theme.colors.borderColor}
                strokeWidth={leftBranchActive ? 2.4 : 1.2}
              />
              <line
                x1={210}
                y1={46}
                x2={310}
                y2={112}
                stroke={rightBranchActive ? theme.colors.accent : theme.colors.borderColor}
                strokeWidth={rightBranchActive ? 2.4 : 1.2}
              />

              {/* Yaprak bağlantıları */}
              {[
                { from: [110, 148], to: [52, 212], room: "R0" },
                { from: [110, 148], to: [152, 212], room: "R3" },
                { from: [310, 148], to: [255, 212], room: "R4" },
                { from: [310, 148], to: [358, 212], room: "R2" },
              ].map((edge) => {
                const active = visibleRooms.has(edge.room);
                return (
                  <line
                    key={edge.room}
                    x1={edge.from[0]}
                    y1={edge.from[1]}
                    x2={edge.to[0]}
                    y2={edge.to[1]}
                    stroke={active ? theme.colors.accentBright : theme.colors.borderColor}
                    strokeDasharray={active ? undefined : "4 4"}
                    strokeWidth={active ? 2 : 1.1}
                  />
                );
              })}

              {/* Kök Düğüm */}
              <rect
                x={140}
                y={12}
                width={140}
                height={36}
                rx={6}
                fill={theme.colors.accentSoft}
                stroke={theme.colors.accent}
                strokeWidth={1.6}
              />
              <text
                x={210}
                y={35}
                textAnchor="middle"
                fill={theme.colors.accentBright}
                fontFamily={FONTS.mono}
                fontSize={12.5}
                fontWeight={600}
              >
                ROOT · PLANE L1
              </text>

              {/* İç Düğümler */}
              {[
                { cx: 110, label: "SOL DAL (L2)", active: leftBranchActive },
                { cx: 310, label: "SAĞ DAL (L3)", active: rightBranchActive },
              ].map((n) => (
                <g key={n.label}>
                  <rect
                    x={n.cx - 66}
                    y={112}
                    width={132}
                    height={36}
                    rx={6}
                    fill={n.active ? theme.colors.accentSoft : theme.colors.surfaceSubtle}
                    stroke={n.active ? theme.colors.accentBorder : theme.colors.borderColor}
                    strokeWidth={n.active ? 1.5 : 1}
                  />
                  <text
                    x={n.cx}
                    y={135}
                    textAnchor="middle"
                    fill={n.active ? theme.colors.textBright : theme.colors.textMuted}
                    fontFamily={FONTS.mono}
                    fontSize={11.5}
                    fontWeight={600}
                  >
                    {n.label}
                  </text>
                </g>
              ))}

              {/* Yaprak Düğümler */}
              {[
                { cx: 52, room: "R0", leaf: "S1" },
                { cx: 152, room: "R3", leaf: "S4" },
                { cx: 255, room: "R4", leaf: "S5" },
                { cx: 358, room: "R2", leaf: "S3" },
              ].map((lf) => {
                const active = visibleRooms.has(lf.room);
                return (
                  <g key={lf.room}>
                    <rect
                      x={lf.cx - 38}
                      y={212}
                      width={76}
                      height={44}
                      rx={6}
                      fill={active ? theme.colors.accentSoft : theme.colors.dangerSoft}
                      stroke={active ? theme.colors.accent : theme.colors.dangerBorder}
                      strokeWidth={active ? 1.6 : 1}
                    />
                    <text
                      x={lf.cx}
                      y={231}
                      textAnchor="middle"
                      fill={active ? theme.colors.accentBright : theme.colors.textMuted}
                      fontFamily={FONTS.mono}
                      fontSize={12}
                      fontWeight={600}
                    >
                      {`${lf.room} (${lf.leaf})`}
                    </text>
                    <text
                      x={lf.cx}
                      y={247}
                      textAnchor="middle"
                      fill={active ? theme.colors.success : theme.colors.danger}
                      fontFamily={FONTS.mono}
                      fontSize={9.5}
                      fontWeight={600}
                    >
                      {active ? "DRAW" : "SKIP"}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Alt PVS Bit Vektörü Satırı */}
            <div
              className="mt-2 flex items-center justify-between px-3 py-2"
              style={{
                borderRadius: 6,
                background: COLORS.surfaceSubtle,
                border: COLORS.border,
                fontFamily: FONTS.mono,
                fontSize: 11.5,
              }}
            >
              <span style={{ color: COLORS.textSecondary }}>PVS MASK:</span>
              <span style={{ color: COLORS.accentBright, fontWeight: 600 }}>
                {`[${ROOMS.map((r) => (visibleRooms.has(r.id) ? "1" : "0")).join(" ")}]`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return card;
  }

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center px-24"
      style={{ fontFamily: FONTS.sans }}
    >
      {card}
      {caption && (
        <div
          className="mt-6 flex items-center gap-3 px-6 py-3"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: COLORS.cardBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: COLORS.border,
          }}
        >
          <span style={{ width: 6, height: 6, background: COLORS.accent }} />
          <span style={{ fontFamily: FONTS.mono, fontSize: 14.5, color: COLORS.textSecondary }}>
            {caption}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
