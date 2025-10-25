import { Button } from "../../../components/Button";
import Icon from "../../../components/Icon";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useCanvasStore } from "../canvasStore";
import { PinComponent } from "../../../components/Pin";

export const Toolbar = () => {
  const tools = [
    { name: "select", icon: "arrow_selector_tool" },
    { name: "pen", icon: "edit" },
    { name: "text", icon: "text_fields" },
    { name: "settings", icon: "settings" }
  ];

  const tool = useCanvasStore(state => state.tool);
  const setTool = useCanvasStore(state => state.setTool);

  const isMobile = useIsMobile();

  const isTappedOpen = useCanvasStore(state => state.toolbarOpen);
  const setIsTappedOpen = useCanvasStore(state => state.setToolbarOpen);

  return (
    <div
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-2/3 sm:w-1/3 rounded-t-2xl bg-neutral-950 z-50 
        border-t border-r border-l border-t-zinc-700 border-zinc-800 group
        shadow-2xl shadow-black
        ${isMobile ? "h-2" : "h-6 hover:h-20"}
        ${isTappedOpen ? "h-20" : "h-4"}
        flex justify-center items-center transition-all duration-150 toolbar`}
    >
      <PinComponent isPinned={isTappedOpen} onClick={() => setIsTappedOpen(!isTappedOpen)} className={`duration-200 transition-opacity group-hover:opacity-100 ${isTappedOpen ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`flex flex-row justify-center gap-4 group-hover:opacity-100 transition-opacity duration-200 ${isTappedOpen ? "opacity-100" : "opacity-0"}`}
      >
        {tools.map(({ name, icon }) => (
          <Button
            key={name}
            onClick={() => {
              setTool(name);
            }}
            className={`${name}-tool rounded-xl`}
            highlighted={tool === name}
          >
            <Icon iconName={icon} fontSize="22px" color="white" />
          </Button>
        ))}
      </div>
    </div>
  );
};
