// CSS cursor for each tool while hovering the canvas.

// Browsers ignore cursor images larger than 128px, so the pen outline is capped below that
const MAX_PEN_CURSOR = 96;
const MIN_PEN_CURSOR = 4;

/**
 * A circle the size of the brush (pen weight is in screen pixels, so this matches what
 * gets drawn at any zoom), faintly filled with the brush colour. A dark halo keeps it
 * visible on light and dark backgrounds.
 */
const penCursor = (size: number, color: string) => {
  const d = Math.min(MAX_PEN_CURSOR, Math.max(MIN_PEN_CURSOR, size));
  const box = Math.ceil(d + 6);
  const c = box / 2;
  const r = d / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="${color}" fill-opacity="0.25" stroke="#000" stroke-opacity="0.55" stroke-width="3"/>` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#fff" stroke-width="1.25"/>` +
    (d >= 14 ? `<circle cx="${c}" cy="${c}" r="1" fill="#fff"/>` : "") +
    `</svg>`;
  const hotspot = Math.round(c);
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hotspot} ${hotspot}, crosshair`;
};

export function toolCursor(tool: string, options: { size?: unknown; color?: string }, disabled = false): string {
  if (disabled) return "default";
  switch (tool) {
    case "pen":
      return penCursor(Number(options.size) || 5, options.color || "#ececef");
    case "text":
      return "text";
    default:
      return "default";
  }
}
