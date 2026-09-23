import { getStroke } from "perfect-freehand";

export type LineStyle = "solid" | "dashed" | "dotted";
export type Taper = "none" | "ends" | "speed";

// Screen pixels moved per pointer event at which a stroke reaches its thinnest.
const FAST_SPEED = 40;
const MIN_PRESSURE = 0.15;

/**
 * Pressure per raw sample, simulated from pointer speed (fast = thin, slow = thick).
 * `screenScale` converts canvas units back to screen pixels so zoom doesn't change the feel.
 */
export function speedPressures(points: { x: number; y: number }[], screenScale = 1): number[] {
  let ema = 0;
  return points.map((p, i) => {
    const q = points[i === 0 ? Math.min(1, points.length - 1) : i - 1];
    const d = Math.hypot(p.x - q.x, p.y - q.y) * screenScale;
    ema = i === 0 ? d : ema * 0.7 + d * 0.3;
    return Math.max(MIN_PRESSURE, 1 - Math.min(1, ema / FAST_SPEED));
  });
}

export const dashFor = (style: LineStyle | undefined, width: number): number[] | undefined => {
  if (style === "dashed") return [width * 2, width * 2.5];
  // A near-zero dash with round caps renders as dots
  if (style === "dotted") return [0.001, width * 2];
  return undefined;
};

export const arrowSize = (width: number) => ({
  length: Math.max(10, width * 3.5),
  width: Math.max(8, width * 3),
});

// Cumulative arc length of a flat point list, normalised to 0..1
const arcFractions = (flat: number[]): number[] => {
  const out = [0];
  let total = 0;
  for (let i = 2; i < flat.length; i += 2) {
    total += Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]);
    out.push(total);
  }
  return out.map(v => (total > 0 ? v / total : 0));
};

/** Map pressures sampled on `from` onto the (differently sampled) polyline `to`, by arc length. */
const resamplePressures = (from: number[], pressures: number[], to: number[]): number[] => {
  const fFrom = arcFractions(from);
  const fTo = arcFractions(to);
  let j = 0;
  return fTo.map(f => {
    while (j < fFrom.length - 2 && fFrom[j + 1] < f) j++;
    const a = fFrom[j], b = fFrom[j + 1] ?? a;
    const t = b > a ? (f - a) / (b - a) : 0;
    const pa = pressures[j] ?? 0.5, pb = pressures[j + 1] ?? pa;
    return pa + (pb - pa) * Math.min(1, Math.max(0, t));
  });
};

/** The point `distance` back from an end of the polyline, used to aim arrowheads. */
const pointBack = (flat: number[], fromEnd: boolean, distance: number) => {
  const n = flat.length / 2;
  const idx = (k: number) => (fromEnd ? n - 1 - k : k);
  let travelled = 0;
  for (let k = 1; k < n; k++) {
    const a = idx(k - 1), b = idx(k);
    travelled += Math.hypot(flat[b * 2] - flat[a * 2], flat[b * 2 + 1] - flat[a * 2 + 1]);
    if (travelled >= distance) return { x: flat[b * 2], y: flat[b * 2 + 1] };
  }
  const last = idx(n - 1);
  return { x: flat[last * 2], y: flat[last * 2 + 1] };
};

/** Cut `distance` off the start or end of a flat polyline. */
const trimPolyline = (flat: number[], atEnd: boolean, distance: number): number[] => {
  const pairs: number[][] = [];
  for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i], flat[i + 1]]);
  if (atEnd) pairs.reverse();
  let remaining = distance;
  while (pairs.length > 2) {
    const [a, b] = pairs;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg > remaining) {
      const t = remaining / seg;
      pairs[0] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      break;
    }
    remaining -= seg;
    pairs.shift();
  }
  if (atEnd) pairs.reverse();
  return pairs.flat();
};

/** Arrowhead triangle [tip, left, right] at the start or end of the centerline. */
export const arrowHead = (centerline: number[], atEnd: boolean, width: number): number[][] | null => {
  const n = centerline.length / 2;
  if (n < 2) return null;
  const size = arrowSize(width);
  const tipIdx = atEnd ? n - 1 : 0;
  const tip = { x: centerline[tipIdx * 2], y: centerline[tipIdx * 2 + 1] };
  const back = pointBack(centerline, atEnd, size.length);
  let dx = tip.x - back.x, dy = tip.y - back.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  dx /= len; dy /= len;
  const bx = tip.x - dx * size.length, by = tip.y - dy * size.length;
  const hw = size.width / 2;
  return [[tip.x, tip.y], [bx - dy * hw, by + dx * hw], [bx + dy * hw, by - dx * hw]];
};

const signedArea = (poly: number[][]) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a;
};

export interface TaperedStroke {
  // Closed polygons to fill in a single path: the stroke outline plus any arrowheads,
  // wound the same way so overlaps don't punch holes or double up alpha.
  polygons: number[][][];
  bounds: { x: number; y: number; width: number; height: number };
}

export function buildTaperedStroke(opts: {
  centerline: number[];          // smoothed flat points
  rawPoints: number[];           // the stored points the pressures belong to
  pressures?: number[];
  width: number;
  taper: Taper;
  arrowStart?: boolean;
  arrowEnd?: boolean;
}): TaperedStroke | null {
  const { centerline, rawPoints, pressures, width, taper, arrowStart, arrowEnd } = opts;
  if (centerline.length < 4) return null;

  // End the stroke inside the arrowhead so it can't poke out past the tip on curves
  const headInset = arrowSize(width).length * 0.6;
  let body = centerline;
  if (arrowStart) body = trimPolyline(body, false, headInset);
  if (arrowEnd) body = trimPolyline(body, true, headInset);

  const pts = resamplePressures(
    rawPoints,
    pressures && pressures.length === rawPoints.length / 2 ? pressures : [],
    body
  );
  const input: number[][] = [];
  for (let i = 0; i < body.length; i += 2) {
    input.push([body[i], body[i + 1], pts[i / 2]]);
  }

  let totalLength = 0;
  for (let i = 2; i < centerline.length; i += 2) {
    totalLength += Math.hypot(centerline[i] - centerline[i - 2], centerline[i + 1] - centerline[i - 1]);
  }

  const isSpeed = taper === "speed";
  const taperLength = Math.min(totalLength * 0.45, width * (isSpeed ? 3 : 8));

  const outline = getStroke(input, {
    // With thinning, full pressure is ~1.7x the base size, so scale it down to keep weights comparable
    size: isSpeed ? width * 0.75 : width,
    thinning: isSpeed ? 0.7 : 0,
    smoothing: 0.5,
    streamline: 0,
    // Until the stroke is finished there are no stored pressures; simulate from spacing meanwhile
    simulatePressure: isSpeed && !(pressures && pressures.length),
    start: { taper: arrowStart ? 0 : taperLength, cap: true },
    end: { taper: arrowEnd ? 0 : taperLength, cap: true },
    last: true,
  });
  if (outline.length < 3) return null;

  const polygons: number[][][] = [outline];
  const wantPositive = signedArea(outline) >= 0;
  for (const [enabled, atEnd] of [[arrowStart, false], [arrowEnd, true]] as const) {
    if (!enabled) continue;
    const head = arrowHead(centerline, atEnd, width);
    if (!head) continue;
    polygons.push(signedArea(head) >= 0 === wantPositive ? head : head.reverse());
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polygons) {
    for (const [x, y] of poly) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { polygons, bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}
