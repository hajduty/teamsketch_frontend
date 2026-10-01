// Draws a plot shape into a 2D context at (0, 0, width, height): on the canvas, in library
// thumbnails and on the minimap, so they all look the same.
import { AssetDef } from "./catalog";

export const ICON_FONT = '"Material Symbols Outlined"';
const LABEL_FONT = '"IBM Plex Sans", system-ui, sans-serif';
const INK = "#ececef";
const NOTE_FILL = "#facc15";

const withAlpha = (hex: string, alpha: number) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
};

const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

/** Where the label goes, in shape coordinates: its centre line and the width it may use. */
export const labelBox = (def: AssetDef, w: number, h: number) => {
  switch (def.outline) {
    case "actor": return { x: w / 2, y: h - 9, width: w * 1.6, size: 13 };
    case "boundary": return { x: 12, y: 16, width: w - 24, size: 13, align: "left" as const };
    case "cylinder": return { x: w / 2, y: h * 0.74, width: w - 16, size: 13 };
    case "note": return { x: w / 2, y: h / 2, width: w - 24, size: 14 };
    default: return { x: w / 2, y: def.icon ? h * 0.72 : h / 2, width: w - 20, size: 13 };
  }
};

/** Path of the outline (without stroking or filling). */
const outlinePath = (c: CanvasRenderingContext2D, def: AssetDef, w: number, h: number) => {
  c.beginPath();
  switch (def.outline) {
    case "rect":
    case "browser":
      roundRect(c, 0, 0, w, h, 4);
      break;
    case "round":
      roundRect(c, 0, 0, w, h, Math.min(w, h) / 3);
      break;
    case "stack":
      roundRect(c, 0, 0, w - 10, h - 10, 6);
      break;
    case "cylinder": {
      const ry = Math.min(14, h * 0.14);
      c.ellipse(w / 2, ry, w / 2, ry, 0, Math.PI, 0);
      c.lineTo(w, h - ry);
      c.ellipse(w / 2, h - ry, w / 2, ry, 0, 0, Math.PI);
      c.closePath();
      break;
    }
    case "bucket":
      c.moveTo(0, 0);
      c.lineTo(w, 0);
      c.lineTo(w * 0.86, h);
      c.lineTo(w * 0.14, h);
      c.closePath();
      break;
    case "hexagon": {
      const d = Math.min(w * 0.18, h / 2);
      c.moveTo(d, 0);
      c.lineTo(w - d, 0);
      c.lineTo(w, h / 2);
      c.lineTo(w - d, h);
      c.lineTo(d, h);
      c.lineTo(0, h / 2);
      c.closePath();
      break;
    }
    case "circle":
      c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case "cloud":
      c.moveTo(w * 0.24, h * 0.92);
      c.bezierCurveTo(w * 0.02, h * 0.92, -w * 0.02, h * 0.52, w * 0.2, h * 0.46);
      c.bezierCurveTo(w * 0.16, h * 0.14, w * 0.5, h * 0.02, w * 0.6, h * 0.24);
      c.bezierCurveTo(w * 0.74, h * 0.08, w * 0.98, h * 0.22, w * 0.88, h * 0.46);
      c.bezierCurveTo(w * 1.04, h * 0.54, w * 1.0, h * 0.94, w * 0.8, h * 0.92);
      c.closePath();
      break;
    case "diamond":
      c.moveTo(w / 2, 0);
      c.lineTo(w, h / 2);
      c.lineTo(w / 2, h);
      c.lineTo(0, h / 2);
      c.closePath();
      break;
    case "parallelogram": {
      const d = Math.min(w * 0.14, 24);
      c.moveTo(d, 0);
      c.lineTo(w, 0);
      c.lineTo(w - d, h);
      c.lineTo(0, h);
      c.closePath();
      break;
    }
    case "queue":
      roundRect(c, 0, 0, w, h, 4);
      break;
    case "phone":
      roundRect(c, 0, 0, w, h, 12);
      break;
    case "note": {
      const f = Math.min(18, w * 0.15);
      c.moveTo(0, 0);
      c.lineTo(w - f, 0);
      c.lineTo(w, f);
      c.lineTo(w, h);
      c.lineTo(0, h);
      c.closePath();
      break;
    }
    case "boundary":
      roundRect(c, 0, 0, w, h, 10);
      break;
    case "actor":
      // Drawn separately as a stick figure
      break;
  }
};

/** Extra lines on top of the outline that make a shape recognisable. */
const details = (c: CanvasRenderingContext2D, def: AssetDef, w: number, h: number) => {
  c.beginPath();
  switch (def.outline) {
    case "stack":
      // Two cards peeking out behind the front one
      c.moveTo(5, h - 10 + 5); c.lineTo(5, h - 5); c.lineTo(w - 5, h - 5); c.lineTo(w - 5, 5); c.lineTo(w - 10 + 5, 5);
      c.moveTo(10, h - 5); c.lineTo(10, h); c.lineTo(w, h); c.lineTo(w, 10); c.lineTo(w - 5, 10);
      break;
    case "cylinder": {
      const ry = Math.min(14, h * 0.14);
      c.ellipse(w / 2, ry, w / 2, ry, 0, 0, Math.PI);
      break;
    }
    case "browser":
      c.moveTo(0, 18); c.lineTo(w, 18);
      c.moveTo(10, 9); c.arc(9, 9, 2.5, 0, Math.PI * 2);
      c.moveTo(19, 9); c.arc(18, 9, 2.5, 0, Math.PI * 2);
      break;
    case "queue":
      // Message slots on the right
      for (let i = 1; i <= 3; i++) {
        const x = w - i * 14;
        c.moveTo(x, 6); c.lineTo(x, h - 6);
      }
      break;
    case "phone":
      c.moveTo(w / 2 - 8, h - 9); c.lineTo(w / 2 + 8, h - 9);
      break;
    case "note": {
      const f = Math.min(18, w * 0.15);
      c.moveTo(w - f, 0); c.lineTo(w - f, f); c.lineTo(w, f);
      break;
    }
  }
  c.stroke();
};

const actor = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const head = Math.min(w, h) * 0.17;
  const cx = w / 2;
  const top = 4;
  c.beginPath();
  c.arc(cx, top + head, head, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  const neck = top + head * 2;
  const hip = h * 0.62;
  c.moveTo(cx, neck); c.lineTo(cx, hip);
  c.moveTo(cx - w * 0.36, neck + h * 0.12); c.lineTo(cx + w * 0.36, neck + h * 0.12);
  c.moveTo(cx, hip); c.lineTo(cx - w * 0.28, h * 0.82);
  c.moveTo(cx, hip); c.lineTo(cx + w * 0.28, h * 0.82);
  c.stroke();
};

const fitText = (c: CanvasRenderingContext2D, text: string, maxWidth: number, size: number) => {
  let fontSize = size;
  c.font = `500 ${fontSize}px ${LABEL_FONT}`;
  while (fontSize > 9 && c.measureText(text).width > maxWidth) {
    fontSize -= 1;
    c.font = `500 ${fontSize}px ${LABEL_FONT}`;
  }
  if (c.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && c.measureText(cut + "…").width > maxWidth) cut = cut.slice(0, -1);
  return cut + "…";
};

export interface DrawAssetOptions {
  color: string;
  label?: string;
  // Hidden while the label is being edited in place
  hideLabel?: boolean;
}

export const drawAsset = (c: CanvasRenderingContext2D, def: AssetDef, w: number, h: number, { color, label, hideLabel }: DrawAssetOptions) => {
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  c.lineWidth = 2;
  c.strokeStyle = color;
  c.fillStyle = def.outline === "note" ? withAlpha(NOTE_FILL, 0.85) : withAlpha(color, def.outline === "boundary" ? 0.04 : 0.14);

  if (def.outline === "actor") {
    actor(c, w, h);
  } else {
    if (def.outline === "boundary") c.setLineDash([8, 6]);
    outlinePath(c, def, w, h);
    c.fill();
    c.stroke();
    c.setLineDash([]);
    details(c, def, w, h);
  }

  if (def.icon) {
    const size = Math.max(14, Math.min(w, h) * (def.outline === "cylinder" ? 0.3 : 0.34));
    const iconY = def.outline === "cylinder" ? h * 0.44 : def.outline === "phone" ? h * 0.42 : h * 0.38;
    c.font = `${size}px ${ICON_FONT}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = color;
    c.fillText(def.icon, w / 2, iconY);
  }

  const text = label ?? def.name;
  if (!hideLabel && text) {
    const box = labelBox(def, w, h);
    c.fillStyle = def.outline === "note" ? "#1f2023" : INK;
    c.textAlign = box.align ?? "center";
    c.textBaseline = "middle";
    c.fillText(fitText(c, text, box.width, box.size), box.x, box.y);
  }
  c.restore();
};

/** Resolves once the icon font can be drawn on a canvas (it loads lazily). */
export const iconFontReady = () =>
  document.fonts?.load ? document.fonts.load(`24px ${ICON_FONT}`).then(() => undefined, () => undefined) : Promise.resolve();
