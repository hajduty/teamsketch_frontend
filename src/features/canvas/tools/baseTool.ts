// tools/baseTool.ts
import * as Y from "yjs";

export interface Point {
  x: number;
  y: number;
  pathId: string;
  color?: string;
  toolType?: string;
}

export interface CanvasObject {
  id: string;
  type: string;
  [key: string]: any;
}

export interface AwarenessState {
  userId: string;
  username: string;
  // Canvas coordinates; null until the pointer is on the canvas
  cursorPosition: {
    x: number;
    y: number;
  } | null;
  color?: string;
  role: string;
}

export interface ToolHandlers {
  handleMouseDown: (e: any) => void;
  handleMouseMove: (e: any) => void;
  handleMouseUp: (e :any) => void;
  handleClick?: (e: any) => void;
  handleDblClick?: (e: any) => void;
  handleSelect?: (e: any) => void;
}

export interface ToolOptions {
  color: string;
  size: number;
  fontSize?: number;
  fontFamily?: string;
  [key: string]: any;
}

export interface Tool {
  create: (
    yObjects: Y.Map<any>,
    isDrawing: boolean,
    setIsDrawing: (drawing: boolean) => void,
    currentState: { current: any },
    options: ToolOptions,
    updateObjectsFromYjs: () => void,
    activeTool: string,
    setSelectedId: (id: string) => void,
    userId: string,
    canDelete: (canDelete: boolean) => void
  ) => ToolHandlers;
}