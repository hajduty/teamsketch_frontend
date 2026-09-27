import { FC } from "react";
import EditableDropdown from "../../../components/EditableDropdown";
import { Color } from "../../../components/Color";
import { useCanvasStore } from "../canvasStore";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { PinComponent } from "../../../components/Pin";
import Icon from "../../../components/Icon";

type SegmentOption<T> = { value: T; label: string };

const Segmented = <T extends string>({ value, options, onChange, disabled }: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) => (
  <div className={`flex w-full text-xs border border-zinc-600 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
    {options.map(option => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`flex-1 px-1 py-1 cursor-pointer duration-100 ${value === option.value ? "bg-blue-500" : "hover:bg-zinc-800"}`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const Toggle = ({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: string; title: string }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`flex-1 flex justify-center py-1 cursor-pointer duration-100 ${active ? "bg-blue-500" : "hover:bg-zinc-800"}`}
  >
    <Icon iconName={icon} fontSize="16px" color="white" />
  </button>
);

const Switch = ({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-8 h-4 rounded-full border border-zinc-600 duration-100 cursor-pointer
      ${checked ? "bg-blue-500" : "bg-zinc-900"} ${disabled ? "opacity-40 pointer-events-none" : ""}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white duration-100 ${checked ? "translate-x-4" : ""}`} />
  </button>
);

const PenOptions = () => {
  const options = [2, 8, 32, 64];
  const simplifyOptions = [0.5, 1, 2.5, 3];

  const setOption = useCanvasStore(state => state.setOption);
  const { color: currentColor, opacity, lineStyle, taper, arrowStart, arrowEnd, stabilizer, smartShapes } =
    useCanvasStore(state => state.options);

  return (
    <>
      <div className="m-6 text-sm select-none">
        <h1 className="text-xl -mx-2 -mt-2 my-8">Pen tool</h1>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-md font-medium mb-1">Stroke</h1>
            <div className="flex flex-row gap-6 items-center justify-between">
              <p className="text-sm font-light">Weight</p>
              <div className="w-22">
                <EditableDropdown
                  options={options}
                  placeholder="24"
                  onChange={(value: any) => setOption("size", value)}
                />
              </div>
            </div>
            <div className="flex flex-row gap-6 items-center justify-between mt-2">
              <p className="text-sm font-light">Color</p>
              <div className="w-22">
                <Color onChange={(value: any) => setOption("color", value)} value={currentColor} />
              </div>
            </div>
            <div className="flex flex-row gap-3 items-center justify-between mt-2">
              <p className="text-sm font-light">Opacity</p>
              <div className="w-22 flex items-center gap-1">
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round((opacity ?? 1) * 100)}
                  onChange={(e) => setOption("opacity", Number(e.target.value) / 100)}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <span className="text-xs w-8 text-right">{Math.round((opacity ?? 1) * 100)}%</span>
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-md font-medium mb-1">Style</h1>
            <p className="text-sm font-light mb-1">Line</p>
            <Segmented
              value={lineStyle ?? "solid"}
              onChange={(value) => setOption("lineStyle", value)}
              disabled={taper !== "none"}
              options={[
                { value: "solid", label: "Solid" },
                { value: "dashed", label: "Dash" },
                { value: "dotted", label: "Dot" },
              ]}
            />
            {taper !== "none" && <p className="text-xs text-zinc-400 mt-1">Dashes need taper off</p>}
            <p className="text-sm font-light mb-1 mt-2">Taper</p>
            <Segmented
              value={taper ?? "none"}
              onChange={(value) => setOption("taper", value)}
              options={[
                { value: "none", label: "None" },
                { value: "ends", label: "Ends" },
                { value: "speed", label: "Speed" },
              ]}
            />
            <p className="text-sm font-light mb-1 mt-2">Arrows</p>
            <div className="flex w-full border border-zinc-600">
              <Toggle title="Arrow at start" icon="arrow_back" active={!!arrowStart} onClick={() => setOption("arrowStart", !arrowStart)} />
              <Toggle title="Arrow at end" icon="arrow_forward" active={!!arrowEnd} onClick={() => setOption("arrowEnd", !arrowEnd)} />
            </div>
          </div>
          <div>
            <h1 className="text-md font-medium mb-1">Stability</h1>
            <div className="flex flex-row gap-6 items-center justify-between">
              <p className="text-sm font-light">Simplify</p>
              <div className="w-22">
                <EditableDropdown
                  options={simplifyOptions}
                  placeholder="1"
                  onChange={(value: any) => setOption("simplify", value)}
                />
              </div>
            </div>
            <div className="flex flex-row gap-3 items-center justify-between mt-2" title="Smooths out hand jitter; the line trails your cursor">
              <p className="text-sm font-light">Stabilizer</p>
              <div className="w-22 flex items-center gap-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={stabilizer ?? 0}
                  onChange={(e) => setOption("stabilizer", Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <span className="text-xs w-8 text-right">{stabilizer ?? 0}</span>
              </div>
            </div>
            <div className="flex flex-row gap-3 items-center justify-between mt-2" title="Rough rectangles, squares, circles and ellipses snap into clean shapes">
              <p className="text-sm font-light">Smart shapes</p>
              <Switch checked={!!smartShapes} onChange={(value) => setOption("smartShapes", value)} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const TextOptions = () => {
  const fontSize = [8, 9, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96];
  const setOption = useCanvasStore(state => state.setOption);
  const currentColor = useCanvasStore().options.color;

  return (
    <>
      <div className="m-6 text-sm select-none">
        <h1 className="text-xl -mx-2 -mt-2 my-8">Text tool</h1>
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex flex-row gap-6 items-center justify-between mt-2">
              <p className="text-sm font-light">Size</p>
              <div className="w-22">
                <EditableDropdown
                  options={fontSize}
                  placeholder="16"
                  onChange={(value: any) => setOption("fontSize", value)}
                />
              </div>
            </div>
            <div className="flex flex-row gap-6 items-center justify-between mt-2">
              <p className="text-sm font-light">Color</p>
              <div className="w-22">
                <Color onChange={(value: any) => setOption("color", value)} value={currentColor} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export const CanvasOptions = ({ roomId }: { roomId: string }) => {
  const saveStageState = useCanvasStore(state => state.saveStageState);
  const currentColor = useCanvasStore().loadStageState(roomId)?.backgroundColor;
  const borderColor = useCanvasStore().loadStageState(roomId)?.borderColor;

  return (
    <>
      <div className="m-6 text-sm select-none">
        <h1 className="text-xl -mx-2 -mt-2 my-8">Canvas options</h1>
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex flex-row gap-6 items-center justify-between mt-2">
              <p className="text-sm font-light">Color</p>
              <div className="w-22">
                <Color onChange={(value: string) => saveStageState(roomId, { backgroundColor: value })} value={currentColor!} />
              </div>
            </div>
            <div className="flex flex-row gap-6 items-center justify-between mt-2">
              <p className="text-sm font-light">Border</p>
              <div className="w-22">
                <Color onChange={(value: string) => saveStageState(roomId, { borderColor: value })} value={borderColor!} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export const ToolOptions = ({ roomId }: { roomId: string }) => {
  const TOOL_OPTIONS: Record<string, FC<any>> = {
    pen: PenOptions,
    text: TextOptions,
    settings: CanvasOptions
  };
  const tool = useCanvasStore(state => state.tool);
  const isMobile = useIsMobile();

  const isTappedOpen = useCanvasStore(state => state.toolOptionsOpen);
  const setIsTappedOpen = useCanvasStore(state => state.setToolOptionsOpen);

  const ToolComponent = TOOL_OPTIONS[tool];

  if (tool == "select")
    return <></>

  return (
    <>
      <div 
        className={`flex flex-col w-52 hover:translate-x-0 rounded-r-2xl bg-neutral-950 fixed min-h-72 h-auto top-1/2
        -translate-y-1/2 left-0 z-3 transform duration-150 border-border border-1 text-white group
        ${isMobile ? "-translate-x-48" : "-translate-x-44"} shadow-2xl shadow-black/50
        ${isTappedOpen ? "translate-x-0 shadow-2xl" : ""} ${tool}-options`}
        
        onClick={(e) => {
          if (isMobile && !isTappedOpen) {
            e.stopPropagation();
            setIsTappedOpen(true);
          }
        }}
      >
        <PinComponent 
          isPinned={isTappedOpen} 
          onClick={() => setIsTappedOpen(!isTappedOpen)} 
          className={`duration-200 transition-opacity group-hover:opacity-100
            ${isTappedOpen ? "opacity-100" : "opacity-0"}`}
        />
        <div className={`flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-white left-0 top-0 ${isTappedOpen ? "opacity-100" : ""}`}>
          {ToolComponent ?
            <ToolComponent roomId={roomId} />
            :
            null
          }
        </div>
      </div>
      
      {isMobile && isTappedOpen && (
        <div 
          className="fixed inset-0 z-2 bg-transparent"
          onClick={() => setIsTappedOpen(false)}
        />
      )}
    </>
  );
};
