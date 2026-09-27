// tools/penTool.ts
// TODO: Debounce pen updates.


import { v4 as uuidv4 } from 'uuid';
import { Tool, ToolHandlers, ToolOptions } from './baseTool';
import * as Y from 'yjs';
import simplify from 'simplify-js';
import { getTransformedPointer } from '../../../utils/utils';
import { resamplePressures, speedPressures } from '../../../utils/penStroke';
import { smoothPathPoints } from '../../../utils/smoothPoints';
import { followPointer, lazyRadius } from '../../../utils/stability';
import { recognizeShape } from '../../../utils/shapeRecognition';

export const PenTool: Tool = {
  create: (
    yObjects: Y.Map<any>,
    isDrawing: boolean,
    setIsDrawing: (drawing: boolean) => void,
    currentState: { current: any },
    options: ToolOptions,
    updateObjectsFromYjs: () => void,
    _activeTool: string,
    _setSelectedId: (id: string) => void,
    _userId: string,
  ): ToolHandlers => {

    const handleMouseDown = (e: any) => {
      setIsDrawing(true);
      
      const stage = e.target.getStage();
      const pointerPosition = getTransformedPointer(stage);
      
      const pathId = uuidv4();
      const yPath = new Y.Map<any>();
      const yPoints = new Y.Array<number>();
      yPoints.push([pointerPosition.x, pointerPosition.y]);

      yPath.set('id', pathId);
      yPath.set('type', 'path');
      yPath.set('points', yPoints);
      yPath.set('color', options.color);
      // Weight is in screen pixels at the current zoom, so the brush feels the same
      // size whether zoomed in or out; the stored width is in canvas units.
      const stageScale = stage.scaleX() || 1;
      yPath.set('strokeWidth', (Number(options.size) || 5) / stageScale);
      yPath.set('toolType', 'pen');
      yPath.set('opacity', options.opacity ?? 1);
      yPath.set('lineStyle', options.lineStyle ?? 'solid');
      yPath.set('taper', options.taper ?? 'none');
      yPath.set('arrowStart', !!options.arrowStart);
      yPath.set('arrowEnd', !!options.arrowEnd);

      yObjects.set(pathId, yPath);

      currentState.current = {
        pathId,
        yPoints,
        // Lazy-brush position; lags the pointer when the stabilizer is on
        brush: pointerPosition,
      };

      updateObjectsFromYjs();
    };
    
    const handleMouseMove = (e: any) => {
      if (!isDrawing) return;
      
      const stage = e.target.getStage();
      const pointerPosition = getTransformedPointer(stage);
      
      const { yPoints, brush } = currentState.current;
      if (!yPoints) return;

      const radius = lazyRadius(Number(options.stabilizer) || 0, stage.scaleX());
      const next = brush ? followPointer(brush, pointerPosition, radius) : pointerPosition;
      if (!next) return;
      currentState.current.brush = next;

      Y.transact(yPoints.doc as Y.Doc, () => {
        yPoints.push([next.x, next.y]);
      }, _userId);

      //updateObjectsFromYjs();
    };
    
    const handleMouseUp = (e?: any) => {
      setIsDrawing(false);

      const { pathId, yPoints } = currentState.current;
      if (!yPoints) return;

      const yPath = yObjects.get(pathId);
      if (yPath) {
        const rawPoints = yPoints.toArray();

        const formattedPoints: { x: number; y: number; i: number }[] = [];
        for (let i = 0; i < rawPoints.length; i += 2) {
          formattedPoints.push({ x: rawPoints[i], y: rawPoints[i + 1], i: i / 2 });
        }

        // Speed has to be measured on the raw samples, before simplify throws the spacing away
        const isSpeedTaper = yPath.get('taper') === 'speed';
        const rawPressures = isSpeedTaper
          ? speedPressures(formattedPoints, e?.target?.getStage?.()?.scaleX?.() ?? 1)
          : [];

        const stageScale = e?.target?.getStage?.()?.scaleX?.() ?? 1;

        // Rough rectangles/squares/circles/ellipses become clean shapes
        const shape = options.smartShapes ? recognizeShape(formattedPoints, stageScale) : null;
        if (shape) {
          Y.transact(yPath.doc as Y.Doc, () => {
            yPoints.delete(0, yPoints.length);
            yPoints.push(shape.points);
            yPath.set('shape', shape.kind);
            yPath.delete('pressures');
          }, _userId);
          currentState.current = {};
          return;
        }

        // Store the smoothed curve that was on screen while drawing (not a re-fit of fewer
        // points), so the stroke doesn't change shape on release. Simplify only drops points
        // within the tolerance, measured in screen pixels.
        const shown = smoothPathPoints(rawPoints);
        const shownPoints: { x: number; y: number }[] = [];
        for (let i = 0; i + 1 < shown.length; i += 2) shownPoints.push({ x: shown[i], y: shown[i + 1] });
        const tolerance = (Number(options.simplify) || 0.5) / stageScale;
        const flattenedSimplified = shownPoints.length >= 2
          ? simplify(shownPoints, tolerance, true).flatMap(p => [p.x, p.y])
          : [];

        if (flattenedSimplified.length > 2) {
          Y.transact(yPath.doc as Y.Doc, () => {
            yPoints.delete(0, yPoints.length);
            yPoints.push(flattenedSimplified);
            yPath.set('smoothed', true);
            if (isSpeedTaper) yPath.set('pressures', resamplePressures(rawPoints, rawPressures, flattenedSimplified));
          }, _userId);
        } else if (isSpeedTaper) {
          Y.transact(yPath.doc as Y.Doc, () => {
            yPath.set('pressures', rawPressures);
          }, _userId);
          //updateObjectsFromYjs();
        }
      }
      
      currentState.current = {};
    };
    
    return {
      handleMouseDown,
      handleMouseMove,
      handleMouseUp
    };
  },
};