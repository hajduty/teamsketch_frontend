// Recognises hand-drawn rectangles, squares, circles and ellipses and returns a clean
// version of the shape. Sizes are compared relative to the shape itself, so it works at
// any zoom; only the "too small to bother" check uses screen pixels.

type Point = { x: number; y: number };

export type ShapeKind = "rectangle" | "square" | "circle" | "ellipse";

export interface RecognizedShape {
  kind: ShapeKind;
  points: number[];   // flat, closed outline (first point not repeated)
}

const SAMPLES = 64;
const MIN_SIZE_PX = 30;          // shapes smaller than this on screen are left alone
const MAX_CLOSING_GAP = 0.2;     // start/end gap, as a fraction of the stroke length
const ELLIPSE_MAX_ERROR = 0.12;  // mean radial deviation, relative to the radius
const RECT_MAX_ERROR = 0.07;     // mean distance to the edges, relative to the half-size
const RECT_CORNER_REACH = 0.15;  // each corner must be drawn within this fraction of the short side
const SQUARE_RATIO = 0.15;       // sides within 15% of each other become a square
const CIRCLE_RATIO = 0.82;       // spread along the minor/major axis at or above this becomes a circle
const AXIS_SNAP_DEG = 8;         // shapes within this many degrees of upright are made upright
const ELLIPSE_SEGMENTS = 72;

const rotate = (p: Point, angle: number): Point => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

const pathLength = (pts: Point[]) =>
  pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

/** Evenly spaced samples along the stroke, so fast and slow parts count equally. */
const resample = (pts: Point[], n: number): Point[] => {
  const total = pathLength(pts);
  if (total === 0) return [];
  const step = total / (n - 1);
  const out: Point[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length && out.length < n; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carry;
    while (d <= seg && out.length < n) {
      out.push({ x: a.x + ((b.x - a.x) * d) / seg, y: a.y + ((b.y - a.y) * d) / seg });
      d += step;
    }
    carry = seg - (d - step);
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
};

const bounds = (pts: Point[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
};

/** Nearest multiple of 90° if within AXIS_SNAP_DEG, else the angle unchanged. */
const snapUpright = (angle: number) => {
  const quarter = Math.PI / 2;
  const nearest = Math.round(angle / quarter) * quarter;
  return Math.abs(angle - nearest) <= (AXIS_SNAP_DEG * Math.PI) / 180 ? nearest : angle;
};

interface Fit { error: number; shape: RecognizedShape }

function fitEllipse(pts: Point[]): Fit | null {
  // Principal axis from the covariance of the samples
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) {
    sxx += (p.x - cx) ** 2;
    syy += (p.y - cy) ** 2;
    sxy += (p.x - cx) * (p.y - cy);
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  // Roundness from the spread along each principal axis (eigenvalues of the covariance);
  // unlike the extents, one wobbly bulge barely moves it
  const mean = (sxx + syy) / 2;
  const spread = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2);
  const roundness = Math.sqrt(Math.max(0, mean - spread) / (mean + spread));

  // Radii and centre from the extents along those axes
  const local = pts.map(p => rotate({ x: p.x - cx, y: p.y - cy }, -angle));
  const b = bounds(local);
  const a = b.w / 2, r2 = b.h / 2;
  if (a === 0 || r2 === 0) return null;
  const ox = (b.minX + b.maxX) / 2, oy = (b.minY + b.maxY) / 2;

  // Mean radial deviation; also require the stroke to go (almost) all the way round
  let error = 0;
  const sectors = new Set<number>();
  for (const p of local) {
    const u = (p.x - ox) / a, v = (p.y - oy) / r2;
    error += Math.abs(Math.hypot(u, v) - 1);
    sectors.add(Math.floor(((Math.atan2(v, u) + Math.PI) / (2 * Math.PI)) * 8) % 8);
  }
  error /= local.length;
  if (sectors.size < 7) return null;

  const centre = rotate({ x: ox, y: oy }, angle);
  const center = { x: centre.x + cx, y: centre.y + cy };

  const isCircle = roundness >= CIRCLE_RATIO;
  let rx = a, ry = r2, rot = angle;
  if (isCircle) {
    rx = ry = (a + r2) / 2;
    rot = 0;
  } else {
    rot = snapUpright(angle);
  }

  const points: number[] = [];
  for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
    const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
    const p = rotate({ x: Math.cos(t) * rx, y: Math.sin(t) * ry }, rot);
    points.push(center.x + p.x, center.y + p.y);
  }
  return { error, shape: { kind: isCircle ? "circle" : "ellipse", points } };
}

function fitRectangle(pts: Point[]): Fit | null {
  // Smallest-area enclosing rectangle over all orientations (1° steps)
  let best = { area: Infinity, angle: 0 };
  for (let deg = 0; deg < 90; deg++) {
    const angle = (deg * Math.PI) / 180;
    const b = bounds(pts.map(p => rotate(p, -angle)));
    const area = b.w * b.h;
    if (area < best.area) best = { area, angle };
  }

  const local = pts.map(p => rotate(p, -best.angle));
  const box = bounds(local);
  if (box.w === 0 || box.h === 0) return null;

  // The enclosing box is pushed out by the wobbliest points. Refit each side robustly:
  // assign every sample to its nearest side, then put the side at the median of those.
  const sides: number[][] = [[], [], [], []]; // left, right, top, bottom
  for (const p of local) {
    const d = [p.x - box.minX, box.maxX - p.x, p.y - box.minY, box.maxY - p.y];
    const side = d.indexOf(Math.min(...d));
    sides[side].push(side < 2 ? p.x : p.y);
  }
  if (sides.some(side => side.length < 3)) return null;
  const median = (v: number[]) => {
    const sorted = [...v].sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const [left, right, top, bottom] = sides.map(median);
  const b = { minX: left, maxX: right, minY: top, maxY: bottom, w: right - left, h: bottom - top };
  if (b.w <= 0 || b.h <= 0) return null;

  // Mean distance from the samples to the nearest refitted edge
  let error = 0;
  for (const p of local) {
    error += Math.min(Math.abs(p.x - b.minX), Math.abs(b.maxX - p.x), Math.abs(p.y - b.minY), Math.abs(b.maxY - p.y));
  }
  error /= local.length * (Math.sqrt(b.w * b.h) / 2);

  // A circle also fits its bounding box loosely; real rectangles reach every corner
  const reach = RECT_CORNER_REACH * Math.min(b.w, b.h);
  const corners = [
    { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY },
  ];
  const allCornersDrawn = corners.every(c => local.some(p => Math.hypot(p.x - c.x, p.y - c.y) <= reach));
  if (!allCornersDrawn) return null;

  // Build the clean rectangle around the same centre
  const centre = rotate({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }, best.angle);
  let w = b.w, h = b.h;
  const isSquare = Math.abs(w - h) / Math.max(w, h) <= SQUARE_RATIO;
  if (isSquare) w = h = (w + h) / 2;
  const rot = snapUpright(best.angle);

  const points: number[] = [];
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p = rotate({ x: (sx * w) / 2, y: (sy * h) / 2 }, rot);
    points.push(centre.x + p.x, centre.y + p.y);
  }
  return { error, shape: { kind: isSquare ? "square" : "rectangle", points } };
}

export function recognizeShape(raw: Point[], stageScale = 1): RecognizedShape | null {
  if (raw.length < 8) return null;

  const box = bounds(raw);
  if (Math.max(box.w, box.h) * stageScale < MIN_SIZE_PX) return null;

  // Must be (roughly) closed
  const length = pathLength(raw);
  const gap = Math.hypot(raw[0].x - raw[raw.length - 1].x, raw[0].y - raw[raw.length - 1].y);
  if (gap > MAX_CLOSING_GAP * length) return null;

  const pts = resample(raw, SAMPLES);
  if (pts.length < SAMPLES) return null;

  const candidates: { score: number; shape: RecognizedShape }[] = [];
  const ellipse = fitEllipse(pts);
  if (ellipse && ellipse.error <= ELLIPSE_MAX_ERROR) {
    candidates.push({ score: ellipse.error / ELLIPSE_MAX_ERROR, shape: ellipse.shape });
  }
  const rect = fitRectangle(pts);
  if (rect && rect.error <= RECT_MAX_ERROR) {
    candidates.push({ score: rect.error / RECT_MAX_ERROR, shape: rect.shape });
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.shape ?? null;
}
