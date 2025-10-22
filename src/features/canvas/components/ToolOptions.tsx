import { FC } from "react";
import EditableDropdown from "../../../components/EditableDropdown";
import { Color } from "../../../components/Color";
import { useCanvasStore } from "../canvasStore";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { PinComponent } from "../../../components/Pin";

const PenOptions = () => {
  const options = [2, 8, 32, 64];
  const simplifyOptions = [0.5, 1, 2.5, 3];
  const tensionOptions = [0.5, 1, 2.5, 3];

  const setOption = useCanvasStore(state => state.setOption);
  const currentColor = useCanvasStore().options.color;

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
          </div>
          <div>
            <h1 className="text-md font-medium mb-2">Smoothness</h1>
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
            <div className="flex flex-row gap-6 items-center justify-between mt-2">
              <p className="text-sm font-light">Tension</p>
              <div className="w-22">
                <EditableDropdown
                  options={tensionOptions}
                  placeholder="0.5"
                  onChange={(value: any) => setOption("tension", value)}
                />
              </div>
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
      <div className={`flex flex-col w-52 hover:translate-x-0 rounded-r-2xl bg-neutral-950 fixed min-h-72 h-auto top-1/2
      -translate-y-1/2 left-0 z-3 transform duration-150 border-border border-1 text-white group
       ${isMobile ? "-translate-x-48" : "-translate-x-44"} shadow-2xl shadow-black/50
       ${isTappedOpen ? "translate-x-0 shadow-2xl" : ""} ${tool}-options`}>
        <PinComponent isPinned={isTappedOpen} onClick={() => setIsTappedOpen(!isTappedOpen)} className={`duration-200 transition-opacity group-hover:opacity-100
           ${isTappedOpen ? "opacity-100" : "opacity-0"}`}/>
        <div className={`flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-white left-0 top-0 ${isTappedOpen ? "opacity-100" : ""}`}>
          {ToolComponent ?
            <ToolComponent roomId={roomId} />
            :
            null
          }
        </div>
      </div>
    </>
  );
};
