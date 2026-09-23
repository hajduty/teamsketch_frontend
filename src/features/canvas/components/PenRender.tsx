import { FC, useEffect, useMemo } from "react";
import { Arrow, Line, Shape, Transformer } from "react-konva";
import Konva from "konva";
import { CanvasObject } from "../tools/baseTool";
import { useTransformer } from "../../../hooks/useTransformer";
import * as Y from "yjs";
import { smoothPathPoints } from "../../../utils/smoothPoints";
import { arrowSize, buildTaperedStroke, dashFor } from "../../../utils/penStroke";
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

  const smoothPoints = useMemo(
    () => (!hasPoints ? [] : shape ? obj.points : smoothPathPoints(obj.points)),
    [obj.points, shape]
  );

  const tapered = useMemo(() => {
    if (taper === "none" || !hasPoints) return null;
    return buildTaperedStroke({
      centerline: smoothPoints,
      rawPoints: obj.points,
      pressures: obj.pressures,
      width,
      taper,
      arrowStart: obj.arrowStart,
      arrowEnd: obj.arrowEnd,
    });
  }, [smoothPoints, obj.pressures, width, taper, obj.arrowStart, obj.arrowEnd]);

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

  const hitStrokeWidth =
    obj.scaleX && obj.scaleX !== 0
      ? Math.min(400, Math.max(20, Math.round(20 / obj.scaleX)))
      : 20;

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

const areEqual = (prevProps: PenRenderProps, nextProps: PenRenderProps) => {
  const a = prevProps.obj, b = nextProps.obj;
  return (
    a.id === b.id &&
    a.selected === b.selected &&
    JSON.stringify(a.points) === JSON.stringify(b.points) &&
    JSON.stringify(a.pressures) === JSON.stringify(b.pressures) &&
    a.color === b.color &&
    a.strokeWidth === b.strokeWidth &&
    a.opacity === b.opacity &&
    a.lineStyle === b.lineStyle &&
    a.taper === b.taper &&
    a.arrowStart === b.arrowStart &&
    a.arrowEnd === b.arrowEnd &&
    a.shape === b.shape &&
    a.x === b.x &&
    a.y === b.y &&
    a.rotation === b.rotation &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY
  );
};

export default React.memo(PenRender, areEqual);
