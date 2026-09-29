import React from "react";
import { FC, useEffect, useRef } from "react";
import { Layer, Shape } from "react-konva";
import Konva from "konva";
import { useCanvasStore } from "../canvasStore";

interface GridProps {
  stageRef: any;
  roomId: string;
}

const BASE_WIDTH = 200;
const BASE_HEIGHT = 200;
const CELL_LIMIT = 500;
const LINE_WIDTH_PX = 1;

/**
 * Background and cell borders for the visible area. Drawn in one shape from the stage's
 * current position and zoom, so panning and zooming don't go through React.
 */
const InfiniteGrid: FC<GridProps> = ({ stageRef, roomId }) => {
  const backgroundColor = useCanvasStore(state => state.stageStates[roomId]?.backgroundColor) ?? "#18191c";
  const borderColor = useCanvasStore(state => state.stageStates[roomId]?.borderColor) ?? "#2a2c31";
  const layerRef = useRef<Konva.Layer>(null);

  // Some pans move the stage without a redraw of their own (e.g. middle-click pan)
  useEffect(() => {
    const stage: Konva.Stage | null = stageRef.current;
    if (!stage) return;
    const redraw = () => layerRef.current?.batchDraw();
    stage.on("xChange.grid yChange.grid scaleXChange.grid scaleYChange.grid", redraw);
    window.addEventListener("resize", redraw);
    return () => {
      stage.off(".grid");
      window.removeEventListener("resize", redraw);
    };
  }, [stageRef]);

  const sceneFunc = (context: Konva.Context) => {
    const stage: Konva.Stage | null = stageRef.current;
    if (!stage) return;

    const scale = stage.scaleX();
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Estimate how many base cells are needed to fill viewport, and grow the cells to stay under the limit
    const estimatedBaseTotal =
      (Math.ceil(width / (BASE_WIDTH * scale)) + 2) * (Math.ceil(height / (BASE_HEIGHT * scale)) + 2);
    let cellSizeMultiplier = 1;
    while ((estimatedBaseTotal / (cellSizeMultiplier * cellSizeMultiplier)) > CELL_LIMIT) cellSizeMultiplier *= 2;
    const actualWidth = BASE_WIDTH * cellSizeMultiplier;
    const actualHeight = BASE_HEIGHT * cellSizeMultiplier;

    const worldLeft = -stage.x() / scale;
    const worldTop = -stage.y() / scale;
    const startX = Math.floor(worldLeft / actualWidth) * actualWidth;
    const endX = Math.ceil((worldLeft + width / scale) / actualWidth) * actualWidth;
    const startY = Math.floor(worldTop / actualHeight) * actualHeight;
    const endY = Math.ceil((worldTop + height / scale) / actualHeight) * actualHeight;

    const ctx = context._context;
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(startX, startY, endX - startX, endY - startY);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += actualWidth) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += actualHeight) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.strokeStyle = borderColor;
    // Same on-screen thickness at any zoom (the context is scaled by the stage)
    ctx.lineWidth = LINE_WIDTH_PX / scale;
    ctx.stroke();
  };

  return (
    <Layer ref={layerRef} listening={false}>
      <Shape sceneFunc={sceneFunc} listening={false} perfectDrawEnabled={false} />
    </Layer>
  );
};

export default React.memo(InfiniteGrid);
