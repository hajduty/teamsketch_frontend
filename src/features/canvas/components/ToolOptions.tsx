import { FC, ReactNode } from "react";
import EditableDropdown from "../../../components/EditableDropdown";
import { Color } from "../../../components/Color";
import { useCanvasStore } from "../canvasStore";
import { useIsCompact } from "../../../hooks/useIsCompact";
import Icon from "../../../components/Icon";
import { IconButton } from "../../../components/IconButton";

const SWATCHES = ["#ececef", "#9a9ca5", "#f0525a", "#f59e0b", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];

type SegmentOption<T> = { value: T; label: string };

const Segmented = <T extends string>({ value, options, onChange, disabled, label }: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={`flex w-full p-0.5 gap-0.5 rounded-md bg-field border border-line text-xs ${disabled ? "opacity-40 pointer-events-none" : ""}`}
  >
    {options.map(option => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        onClick={() => onChange(option.value)}
        className={`flex-1 h-7 rounded cursor-pointer transition-colors duration-100
          ${value === option.value ? "bg-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative w-8 h-[18px] rounded-full transition-colors duration-150 cursor-pointer flex-shrink-0
      ${checked ? "bg-accent" : "bg-raised border border-line-strong"}`}
  >
    <span className={`absolute top-1/2 -translate-y-1/2 left-[3px] size-3 rounded-full bg-white transition-transform duration-150 ${checked ? "translate-x-3.5" : ""}`} />
  </button>
);

const Swatches = ({ value, onChange }: { value: string; onChange: (color: string) => void }) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Quick colors">
    {SWATCHES.map(color => (
      <button
        key={color}
        type="button"
        role="radio"
        aria-checked={value?.toLowerCase() === color}
        aria-label={color}
        onClick={() => onChange(color)}
        className={`size-5 rounded-full cursor-pointer border border-white/10 transition-shadow
          ${value?.toLowerCase() === color ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "hover:ring-1 hover:ring-line-strong hover:ring-offset-1 hover:ring-offset-surface"}`}
        style={{ backgroundColor: color }}
      />
    ))}
  </div>
);

const Section = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2.5 px-4 py-3 border-t border-line first:border-t-0">
    {title && <h3 className="text-xs font-medium text-ink-faint">{title}</h3>}
    {children}
  </section>
);

const Row = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <div className="flex items-center justify-between gap-3" title={hint}>
    <span className="text-ink-muted">{label}</span>
    {children}
  </div>
);

const Slider = ({ value, min, max, step, onChange, format, label }: {
  value: number; min: number; max: number; step: number; label: string;
  onChange: (value: number) => void; format: (value: number) => string;
}) => (
  <div className="flex items-center gap-2 w-32">
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="range w-full"
      style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
    />
    <span className="text-xs w-9 text-right text-ink tabular">{format(value)}</span>
  </div>
);

const PenOptions = () => {
  const setOption = useCanvasStore(state => state.setOption);
  const { size, color, opacity, lineStyle, taper, arrowStart, arrowEnd, stabilizer, smartShapes, simplify } =
    useCanvasStore(state => state.options);

  return (
    <>
      <Section>
        <Row label="Weight">
          <div className="w-32">
            <EditableDropdown options={[2, 4, 8, 16, 32, 64]} value={size} placeholder="5" onChange={(value: any) => setOption("size", value)} />
          </div>
        </Row>
        <Row label="Opacity">
          <Slider label="Opacity" min={10} max={100} step={5} value={Math.round((opacity ?? 1) * 100)}
            onChange={(v) => setOption("opacity", v / 100)} format={(v) => `${v}%`} />
        </Row>
        <Swatches value={color} onChange={(value) => setOption("color", value)} />
        <Color onChange={(value: any) => setOption("color", value)} value={color} />
      </Section>

      <Section title="Style">
        <Segmented
          label="Line style"
          value={lineStyle ?? "solid"}
          onChange={(value) => setOption("lineStyle", value)}
          disabled={taper !== "none"}
          options={[
            { value: "solid", label: "Solid" },
            { value: "dashed", label: "Dashed" },
            { value: "dotted", label: "Dotted" },
          ]}
        />
        <Segmented
          label="Taper"
          value={taper ?? "none"}
          onChange={(value) => setOption("taper", value)}
          options={[
            { value: "none", label: "No taper" },
            { value: "ends", label: "Ends" },
            { value: "speed", label: "Speed" },
          ]}
        />
        {taper !== "none" && <p className="text-xs text-ink-faint -mt-1">Dashed and dotted lines need taper off.</p>}
        <Row label="Arrows">
          <div className="flex gap-1">
            <IconButton icon="west" label="Arrow at start" active={!!arrowStart} onClick={() => setOption("arrowStart", !arrowStart)} />
            <IconButton icon="east" label="Arrow at end" active={!!arrowEnd} onClick={() => setOption("arrowEnd", !arrowEnd)} />
          </div>
        </Row>
      </Section>

      <Section title="Stability">
        <Row label="Stabilizer" hint="Smooths out hand jitter; the line trails your cursor">
          <Slider label="Stabilizer" min={0} max={100} step={5} value={stabilizer ?? 0}
            onChange={(v) => setOption("stabilizer", v)} format={(v) => `${v}`} />
        </Row>
        <Row label="Simplify" hint="How far, in screen pixels, a finished stroke may be simplified">
          <div className="w-32">
            <EditableDropdown options={[0.5, 1, 2.5, 3]} value={simplify ?? 0.5} placeholder="0.5" onChange={(value: any) => setOption("simplify", value)} />
          </div>
        </Row>
        <Row label="Smart shapes" hint="Rough rectangles, squares, circles and ellipses snap into clean shapes">
          <Switch label="Smart shapes" checked={!!smartShapes} onChange={(value) => setOption("smartShapes", value)} />
        </Row>
      </Section>
    </>
  );
};

const TextOptions = () => {
  const setOption = useCanvasStore(state => state.setOption);
  const { fontSize, color } = useCanvasStore(state => state.options);

  return (
    <Section>
      <Row label="Size">
        <div className="w-32">
          <EditableDropdown options={[8, 9, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96]} value={fontSize} placeholder="16"
            onChange={(value: any) => setOption("fontSize", value)} />
        </div>
      </Row>
      <Swatches value={color} onChange={(value) => setOption("color", value)} />
      <Color onChange={(value: any) => setOption("color", value)} value={color} />
    </Section>
  );
};

export const CanvasOptions = ({ roomId }: { roomId: string }) => {
  const saveStageState = useCanvasStore(state => state.saveStageState);
  const stage = useCanvasStore(state => state.stageStates[roomId]);

  return (
    <Section>
      <Row label="Background">
        <div className="w-32">
          <Color onChange={(value: string) => saveStageState(roomId, { backgroundColor: value })} value={stage?.backgroundColor ?? "#0b0b0b"} />
        </div>
      </Row>
      <Row label="Grid lines">
        <div className="w-32">
          <Color onChange={(value: string) => saveStageState(roomId, { borderColor: value })} value={stage?.borderColor ?? "#2a2a2a"} />
        </div>
      </Row>
    </Section>
  );
};

const PANELS: Record<string, { title: string; icon: string; Component: FC<{ roomId: string }> }> = {
  pen: { title: "Pen", icon: "edit", Component: PenOptions },
  text: { title: "Text", icon: "text_fields", Component: TextOptions },
  canvas: { title: "Canvas settings", icon: "tune", Component: CanvasOptions },
};

export const ToolOptions = ({ roomId }: { roomId: string }) => {
  const compact = useIsCompact();
  const tool = useCanvasStore(state => state.tool);
  const open = useCanvasStore(state => state.toolOptionsOpen);
  const optionsPanel = useCanvasStore(state => state.optionsPanel);
  const setOpen = useCanvasStore(state => state.setToolOptionsOpen);

  const key = optionsPanel === "canvas" ? "canvas" : tool;
  const panel = PANELS[key];
  if (!open || !panel) return null;
  const { title, icon, Component } = panel;

  return (
    <aside
      aria-label={`${title} options`}
      className={`${key === "canvas" ? "settings" : key}-options island fixed z-20 w-64 text-sm text-ink select-none
        ${compact
          ? "left-3 right-3 w-auto bottom-[72px] max-h-[calc(100dvh-150px)] overflow-y-auto overflow-x-hidden scrollbar-thin"
          : "left-[68px] top-1/2 -translate-y-1/2 max-h-[calc(100dvh-24px)] overflow-y-auto overflow-x-hidden scrollbar-thin"}`}
    >
      <header className="flex items-center gap-2 pl-4 pr-1.5 h-11 border-b border-line">
        <Icon iconName={icon} fontSize="18px" className="text-ink-muted" />
        <h2 className="font-medium flex-1">{title}</h2>
        <IconButton icon="close" label="Close" onClick={() => setOpen(false)} tooltip="bottom" />
      </header>
      <Component roomId={roomId} />
    </aside>
  );
};
