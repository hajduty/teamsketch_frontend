import React, { FC, useEffect, useRef } from "react";
import { Shape, Transformer } from "react-konva";
import { Html } from "react-konva-utils";
import Konva from "konva";
import * as Y from "yjs";
import { CanvasObject } from "../tools/baseTool";
import { useTransformer } from "../../../hooks/useTransformer";
import { useCanvasStore } from "../canvasStore";
import { categoryColor, getAsset } from "../assets/catalog";
import { drawAsset, iconFontReady, labelBox } from "../assets/draw";

interface AssetRenderProps {
  obj: CanvasObject;
  yObjects: Y.Map<unknown>;
  updateObjectsFromYjs: () => void;
  activeTool: string;
  editing: boolean;
}

const MIN_SIZE = 24;

/** A plot shape (server, database, ...): one Konva shape drawn with the shared asset drawing. */
const AssetRender: FC<AssetRenderProps> = ({ obj, yObjects, updateObjectsFromYjs, activeTool, editing }) => {
  const {
    shapeRef,
    transformerRef,
    bindTransformer,
    updateObject,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    preventDefault,
  } = useTransformer(obj, yObjects, updateObjectsFromYjs);
  const setEditing = useCanvasStore(state => state.setEditing);
  const setEditingId = useCanvasStore(state => state.setEditingId);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const def = getAsset(obj.assetId);
  const width = obj.width || def?.width || 100;
  const height = obj.height || def?.height || 80;
  const color = obj.color || (def ? categoryColor(def) : "#9a9ca5");

  // The transformer is recreated after editing the label, so attach it again then too
  useEffect(() => {
    if (!editing) bindTransformer();
  }, [bindTransformer, editing, activeTool]);

  // The icons come from a web font; redraw once it can be used on the canvas
  useEffect(() => {
    iconFontReady().then(() => shapeRef.current?.getLayer()?.batchDraw());
  }, [shapeRef]);


  if (!def) return null;

  const finishEditing = (save: boolean) => {
    if (save) {
      const text = inputRef.current?.value.trim() ?? "";
      // An empty label goes back to the shape's name
      updateObject({ label: text && text !== def.name ? text : undefined });
    }
    setEditing(false);
    setEditingId("");
  };

  // Resizing changes the size instead of scaling, so outlines and text stay crisp
  const bakeScale = (node: Konva.Node) => {
    const w = Math.max(MIN_SIZE, node.width() * Math.abs(node.scaleX()));
    const h = Math.max(MIN_SIZE, node.height() * Math.abs(node.scaleY()));
    node.setAttrs({ width: w, height: h, scaleX: 1, scaleY: 1 });
    return { w, h };
  };

  const label = labelBox(def, width, height);
  // Only the select tool moves or resizes; with the pen, a drag must only draw
  const editable = !!obj.selected && activeTool === "select" && !editing;

  return (
    <>
      <Shape
        ref={shapeRef}
        id={obj.id}
        assetId={obj.assetId}
        x={obj.x}
        y={obj.y}
        width={width}
        height={height}
        rotation={obj.rotation || 0}
        opacity={obj.opacity ?? 1}
        draggable={editable}
        // Only used to fill the hit area; the drawing below ignores it
        fill="rgba(0,0,0,0)"
        perfectDrawEnabled={false}
        sceneFunc={(context: Konva.Context, shape: Konva.Shape) => {
          drawAsset(context._context, def, shape.width(), shape.height(), { color, label: obj.label, hideLabel: editing });
        }}
        hitFunc={(context: Konva.Context, shape: Konva.Shape) => {
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        onDblClick={(e) => {
          if (activeTool !== "select") return;
          e.cancelBubble = true;
          setEditing(true);
          setEditingId(obj.id);
        }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransform={(e) => bakeScale(e.target)}
        onTransformEnd={(e) => {
          const { w, h } = bakeScale(e.target);
          updateObject({ x: e.target.x(), y: e.target.y(), rotation: e.target.rotation(), width: w, height: h });
        }}
      />
      {editable && (
        <Transformer
          ref={transformerRef}
          onDragStart={preventDefault}
          onDragEnd={preventDefault}
          boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? oldBox : newBox)}
        />
      )}
      {editing && (
        <Html groupProps={{ x: obj.x, y: obj.y, rotation: obj.rotation || 0 }}>
          <textarea
            // The editor renders through its own root, after this component's effects, so it
            // focuses itself when it appears; otherwise typing would go to the canvas
            ref={(el) => {
              if (el && inputRef.current !== el) {
                el.focus();
                el.select();
              }
              inputRef.current = el;
            }}
            aria-label="Shape label"
            defaultValue={obj.label ?? def.name}
            rows={1}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finishEditing(true); }
              if (e.key === "Escape") finishEditing(false);
            }}
            onBlur={() => finishEditing(true)}
            style={{
              position: "absolute",
              left: label.align === "left" ? label.x : label.x - label.width / 2,
              top: label.y - label.size,
              width: label.width,
              height: label.size * 2,
              fontSize: label.size,
              fontWeight: 500,
              lineHeight: `${label.size * 2}px`,
              textAlign: label.align ?? "center",
              color: def.outline === "note" ? "#1f2023" : "#ececef",
              background: "transparent",
              border: "none",
              outline: "1px dashed rgba(255,255,255,0.35)",
              borderRadius: 4,
              padding: 0,
              resize: "none",
              overflow: "hidden",
              fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            }}
          />
        </Html>
      )}
    </>
  );
};

const areEqual = (prev: AssetRenderProps, next: AssetRenderProps) =>
  prev.obj === next.obj && prev.editing === next.editing && prev.activeTool === next.activeTool;

export default React.memo(AssetRender, areEqual);
