import { IconButton } from "../../../components/IconButton";
import { useIsCompact } from "../../../hooks/useIsCompact";
import { useCanvasStore } from "../canvasStore";

const TOOLS = [
  { name: "select", icon: "arrow_selector_tool", label: "Select" },
  { name: "pen", icon: "edit", label: "Pen" },
  { name: "text", icon: "text_fields", label: "Text" },
];

export const Toolbar = () => {
  const compact = useIsCompact();
  const tool = useCanvasStore(state => state.tool);
  const selectTool = useCanvasStore(state => state.selectTool);
  const toggleCanvasSettings = useCanvasStore(state => state.toggleCanvasSettings);
  const canvasSettingsOpen = useCanvasStore(state => state.toolOptionsOpen && state.optionsPanel === "canvas");
  const undo = useCanvasStore(state => state.undo);
  const redo = useCanvasStore(state => state.redo);
  const canUndo = useCanvasStore(state => state.canUndo);
  const canRedo = useCanvasStore(state => state.canRedo);

  const tooltip = compact ? "top" : "right";
  const divider = <div className={compact ? "w-px my-1 mx-0.5 bg-line" : "h-px my-1 bg-line"} />;

  return (
    <nav
      aria-label="Tools"
      className={`toolbar island fixed z-20 flex gap-1 p-1.5
        ${compact
          ? "bottom-3 left-1/2 -translate-x-1/2 flex-row"
          : "left-3 top-1/2 -translate-y-1/2 flex-col"}`}
    >
      {TOOLS.map(({ name, icon, label }) => (
        <IconButton
          key={name}
          icon={icon}
          label={label}
          active={tool === name}
          onClick={() => selectTool(name)}
          tooltip={tooltip}
          className={`${name}-tool`}
        />
      ))}
      {divider}
      <IconButton
        icon="tune"
        label="Canvas settings"
        active={canvasSettingsOpen}
        onClick={toggleCanvasSettings}
        tooltip={tooltip}
        className="settings-tool"
      />
      {/* On phones undo/redo live here; on larger screens they're in the bottom-left bar */}
      {compact && (
        <>
          {divider}
          <IconButton icon="undo" label="Undo" onClick={undo} disabled={!canUndo} tooltip={tooltip} className="history-buttons" />
          <IconButton icon="redo" label="Redo" onClick={redo} disabled={!canRedo} tooltip={tooltip} />
        </>
      )}
    </nav>
  );
};
