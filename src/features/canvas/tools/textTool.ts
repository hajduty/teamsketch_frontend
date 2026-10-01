// tools/textTool.ts
import { v4 as uuidv4 } from 'uuid';
import { Tool, ToolHandlers, ToolOptions } from './baseTool';
import * as Y from 'yjs';
import { getTransformedPointer } from '../../../utils/utils';
import { useCanvasStore } from '../canvasStore';

export const TextTool: Tool = {
  create: (
    yObjects: Y.Map<any>,
    _isDrawing: boolean,
    _setIsDrawing: (drawing: boolean) => void,
    _currentState: { current: any },
    options: ToolOptions,
    updateObjectsFromYjs: () => void,
    activeTool: string,
    _setSelectedId,
    _userId,
  ): ToolHandlers => {

    const handleClick = (e: any) => {
      if (activeTool !== 'text') return;

      const clickedOnText = e.target.findAncestor('Text');
      // Clicking empty canvas deselects (the selection is local to this tab)
      if (!clickedOnText) useCanvasStore.getState().setSelection([]);
    };

    const handleDblClick = (e: any) => {
      if (activeTool !== 'text') return;

      const stage = e.target.getStage();
      
      if (e.target === stage || e.target.className !== 'Text') {
        const pointerPosition = getTransformedPointer(stage);
        
        if (!pointerPosition) return;

        const textObj = {
          id: uuidv4(),
          type: 'text',
          x: pointerPosition.x,
          y: pointerPosition.y,
          text: 'Sample text',
          fontSize: options.fontSize || 16,
          fontFamily: options.fontFamily || 'Arial',
          color: options.color || '#000000',
          width: 200,
          rotation: 0
        };

        Y.transact(yObjects.doc as Y.Doc, () => {
          // Create new text object
          const yTextObj = new Y.Map();
          Object.entries(textObj).forEach(([key, value]) => {
            yTextObj.set(key, value);
          });
          yObjects.set(textObj.id, yTextObj);
        }, _userId);
        // The new text is the (local) selection
        useCanvasStore.getState().setSelection([textObj.id]);

        updateObjectsFromYjs();
      }
    };

    return {
      handleMouseDown: () => {},
      handleMouseMove: () => {},
      handleMouseUp: () => {},
      handleClick,
      handleDblClick
    };
  }
};