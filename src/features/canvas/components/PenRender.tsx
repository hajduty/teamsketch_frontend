import { FC, useEffect, useMemo } from "react";
import { Arrow, Line, Shape, Transformer } from "react-konva";
import Konva from "konva";
import { CanvasObject } from "../tools/baseTool";
import { useTransformer } from "../../../hooks/useTransformer";
import * as Y from "yjs";
import { smoothPathPoints } from "../../../utils/smoothPoints";
import { arrowSize, buildTaperedStroke, dashFor, speedPressures } from "../../../utils/penStroke";
import React from "react";

interface PenRenderProps {
  obj: CanvasObject;
  isSelected: boolean;
  stageRef: any;
  yObjects: Y.Map<any>;
  updateObjectsFromYjs: () => void;
  userId: string;
}

const PenRender: FC<PenRenderProps> = ({
  obj,
  yObjects,
  updateObjectsFromYjs,
  stageRef,
  //userId
}) => {
  const {
    shapeRef,
    transformerRef,
    bindTransformer,
    handleTransformEnd,
    handleTransformStart,
    handleDragMove,
    handleDragEnd,
    preventDefault,
    handleDragStart,
  } = useTransformer(obj, yObjects, updateObjectsFromYjs);

  const width: number = obj.strokeWidth || 2;
  const color: string = obj.color || "#000";
  // Recognised shapes are exact outlines: no smoothing, taper or arrows
  const shape: string | undefined = obj.shape;
  const taper = shape ? "none" : obj.taper ?? "none";
  const hasPoints = Array.isArray(obj.points);

  // Finished strokes store their already-smoothed curve; only strokes in progress
  // (and ones saved before that) are smoothed here
  const smoothPoints = useMemo(
    () => (!hasPoints ? [] : shape || obj.smoothed ? obj.points : smoothPathPoints(obj.points)),
    [obj.points, shape, obj.smoothed]
  );

  // While drawing a speed-tapered stroke, derive pressure the same way the tool will on
  // release, so the width doesn't jump when the stroke is finished
  const pressures = useMemo(() => {
    if (obj.pressures || taper !== "speed" || !hasPoints) return obj.pressures;
    const raw: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < obj.points.length; i += 2) raw.push({ x: obj.points[i], y: obj.points[i + 1] });
    return speedPressures(raw, stageRef?.current?.scaleX?.() ?? 1);
  }, [obj.pressures, obj.points, taper]);

  const tapered = useMemo(() => {
    if (taper === "none" || !hasPoints) return null;
    return buildTaperedStroke({
      centerline: smoothPoints,
      rawPoints: obj.points,
      pressures,
      width,
      taper,
      arrowStart: obj.arrowStart,
      arrowEnd: obj.arrowEnd,
    });
  }, [smoothPoints, pressures, width, taper, obj.arrowStart, obj.arrowEnd]);

  // Custom shapes report a zero-size box by default; give the transformer the outline's bounds.
  useEffect(() => {
    if (!tapered || !shapeRef.current) return;
    shapeRef.current.getSelfRect = () => tapered.bounds;
    transformerRef.current?.forceUpdate();
  }, [tapered]);

  useEffect(() => {
    bindTransformer();
  }, [bindTransformer]);

  if (!hasPoints) return null;

  // Never narrower than the stroke itself (strokes drawn zoomed out can be very wide)
  const hitStrokeWidth = Math.max(
    width,
    obj.scaleX && obj.scaleX !== 0
      ? Math.min(400, Math.max(20, Math.round(20 / obj.scaleX)))
      : 20
  );

  const common = {
    ref: shapeRef,
    id: obj.id,
    x: obj.x,
    y: obj.y,
    rotation: obj.rotation,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    opacity: obj.opacity ?? 1,
    draggable: obj.selected,
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    onTransformStart: handleTransformStart,
    hitStrokeWidth,
  };

  let stroke: React.ReactNode;
  if (taper !== "none") {
    // Variable-width stroke: one filled path (outline + arrowheads) so opacity stays uniform
    stroke = tapered ? (
      <Shape
        {...common}
        fill={color}
        stroke={color}
        strokeWidth={width}
        sceneFunc={(context: Konva.Context, shape: Konva.Shape) => {
          context.beginPath();
          for (const poly of tapered.polygons) {
            context.moveTo(poly[0][0], poly[0][1]);
            for (let i = 1; i < poly.length; i++) context.lineTo(poly[i][0], poly[i][1]);
            context.closePath();
          }
          context.fillShape(shape);
        }}
        hitFunc={(context: Konva.Context, shape: Konva.Shape) => {
          context.beginPath();
          context.moveTo(smoothPoints[0], smoothPoints[1]);
          for (let i = 2; i < smoothPoints.length; i += 2) context.lineTo(smoothPoints[i], smoothPoints[i + 1]);
          context.strokeShape(shape);
        }}
      />
    ) : null;
  } else {
    const lineProps = {
      ...common,
      points: smoothPoints,
      stroke: color,
      strokeWidth: width,
      dash: dashFor(obj.lineStyle, width),
      lineCap: "round" as const,
      // Crisp corners on rectangles/squares
      lineJoin: shape === "rectangle" || shape === "square" ? "miter" as const : "round" as const,
      closed: !!shape,
    };
    if (!shape && (obj.arrowStart || obj.arrowEnd)) {
      const size = arrowSize(width);
      stroke = (
        <Arrow
          {...lineProps}
          fill={color}
          pointerAtBeginning={!!obj.arrowStart}
          pointerAtEnding={!!obj.arrowEnd}
          pointerLength={size.length}
          pointerWidth={size.width}
        />
      );
    } else {
      stroke = <Line {...lineProps} />;
    }
  }

  return (
    <>
      {stroke}
      {obj.selected && (
        <Transformer
          ref={transformerRef}
          onDragEnd={preventDefault}
          onDragStart={preventDefault}
        />
      )}
    </>
  );
};

// The canvas keeps an object's identity until it changes in Yjs, so this skips unchanged
// strokes without comparing their points
const areEqual = (prevProps: PenRenderProps, nextProps: PenRenderProps) => prevProps.obj === nextProps.obj;

export default React.memo(PenRender, areEqual);
