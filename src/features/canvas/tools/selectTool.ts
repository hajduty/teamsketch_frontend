// tools/selectTool.ts
import { Tool, ToolHandlers } from './baseTool';
import * as Y from 'yjs';
import { useCanvasStore } from '../canvasStore';

export const SelectTool: Tool = {
  // Only needs the objects: the selection lives in the store
  create: (
    yObjects: Y.Map<any>,
  ): ToolHandlers => {    
    const handleClick = (e: any) => {
      const node = e.target;
      const validTypes = ['Text', 'Line', 'Arrow', 'Shape'];
    
      const targetNode = validTypes.includes(node.getClassName())
        ? node
        : node.findAncestor((n: any) => validTypes.includes(n.getClassName()));
        console.log('Clicked:', node.getClassName(), node.attrs.id);
    
      // The selection is local to this tab (see the store)
      const selectedId: string | undefined = targetNode?.attrs.id;
      useCanvasStore.getState().setSelection(selectedId && yObjects.has(selectedId) ? [selectedId] : []);
    };
    
    
    return {
      handleClick,
      handleMouseDown: () => { },
      handleMouseMove: () => { },
      handleMouseUp: () => { }
    };
  },
};