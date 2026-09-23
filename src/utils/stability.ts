// Pen stabilizer (lazy brush). The radius is in screen pixels and converted with the
// stage scale, so the feel doesn't change with zoom.

type Point = { x: number; y: number };

// Stabilizer 100 = the brush trails the pointer on a 40px "string"
const MAX_LAZY_RADIUS = 40;

/** Radius of the lazy-brush string, in canvas units. 0 disables the stabilizer. */
export const lazyRadius = (stabilizer: number, stageScale: number) =>
  (Math.max(0, Math.min(100, stabilizer)) / 100) * MAX_LAZY_RADIUS / (stageScale || 1);

/**
 * Lazy brush: the brush only moves once the pointer pulls the string tight, which
 * filters out hand jitter. Returns the new brush position, or null if it didn't move.
 */
export function followPointer(brush: Point, pointer: Point, radius: number): Point | null {
  if (radius <= 0) return pointer;
  const dx = pointer.x - brush.x, dy = pointer.y - brush.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius) return null;
  const pull = (dist - radius) / dist;
  return { x: brush.x + dx * pull, y: brush.y + dy * pull };
}
