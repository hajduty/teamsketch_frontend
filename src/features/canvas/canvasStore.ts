import { create, StateCreator } from 'zustand';
import * as Y from 'yjs';
import { ToolOptions } from './tools/baseTool';
import { Permissions } from "../../types/permission";

interface CanvasState {
  tool: string;
  options: ToolOptions;
  canUndo: boolean;
  canRedo: boolean;
  editing: boolean;
  editingId: string;
  guestRooms: Permissions[];
  stageStates: Record<string, { x: number; y: number; scale: number }>;
}

interface CanvasActions {
  init: (ydoc: Y.Doc, yObjects: Y.Map<any>, undoManager: Y.UndoManager) => void;
  setTool: (tool: string) => void;
  setEditing: (state: boolean) => void;
  setEditingId: (id: string) => void;
  setOption: <K extends keyof ToolOptions>(key: K, value: ToolOptions[K]) => void;
  setUndoRedoStatus: (canUndo: boolean, canRedo: boolean) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  addGuestRoom: (state: Permissions) => void;
  saveStageState: (roomId: string, pos: { x: number, y: number }, scale: number) => void;
  loadStageState: (roomId: string) => { x: number; y: number; scale: number; } | null;
}

type CanvasStore = CanvasState & CanvasActions;

let ydoc: Y.Doc | null = null;
let yObjects: Y.Map<any> | null = null;
let undoManager: Y.UndoManager | null = null;

export const useCanvasStore = create<CanvasStore>(
  ((set, get) => ({
    // --- STATE ---
    tool: 'pen',
    options: {
      color: 'white',
      size: 5,
      fontSize: 16,
      fontFamily: 'Arial',
    },
    canUndo: false,
    canRedo: false,
    editing: false,
    editingId: "",
    guestRooms: [],
    stageStates: (() => {
      try {
        return JSON.parse(localStorage.getItem("stageStates") || "{}");
      } catch {
        return {};
      }
    })(),

    init: async (doc, objects, manager) => {
      ydoc = doc;
      yObjects = objects;
      undoManager = manager;

      if (undoManager) {
        set({
          canUndo: undoManager.canUndo(),
          canRedo: undoManager.canRedo(),
        });
      }

      const savedGuestRooms = localStorage.getItem("guestRooms");
      if (savedGuestRooms) {
        try {
          const parsedRooms = JSON.parse(savedGuestRooms);
          set({ guestRooms: parsedRooms });
        } catch (error) {
          console.error("Failed to parse guestRooms from localStorage:", error);
        }
      }
    },

    setTool: (tool) => set({ tool }),

    setOption: (key, value) => set((state) => ({
      options: { ...state.options, [key]: value },
    })),

    addGuestRoom: (newRoom) => {
      const currentRooms = get().guestRooms;

      const alreadyExists = currentRooms.some((room) => room.room === newRoom.room);
      if (alreadyExists) return;

      const updatedRooms = [...currentRooms, newRoom];
      set({ guestRooms: updatedRooms });
      localStorage.setItem("guestRooms", JSON.stringify(updatedRooms));
    },

    setEditing: (editing) => set({ editing }),

    setEditingId: (editingId: string) => set({ editingId }),

    setUndoRedoStatus: (canUndo, canRedo) => set({ canUndo, canRedo }),

    undo: () => {
      if (undoManager) {
        undoManager.undo();
        get().setUndoRedoStatus(undoManager.canUndo(), undoManager.canRedo());
      }
    },

    redo: () => {
      if (undoManager) {
        undoManager.redo();
        get().setUndoRedoStatus(undoManager.canUndo(), undoManager.canRedo());
      }
    },

    clear: () => {
      if (yObjects && ydoc) {
        Y.transact(ydoc, () => {
          yObjects!.forEach((_: any, key: string) => yObjects!.delete(key));
        });
      }
    },

    saveStageState: (roomId: string, pos: { x: number; y: number }, scale?: number) => {
      set(state => {
        const prevRoomState = state.stageStates[roomId] ?? { scale: 1 };
        const updated = {
          ...state.stageStates, // merge all existing rooms
          [roomId]: { ...pos, scale: scale ?? prevRoomState.scale }
        };

        localStorage.setItem("stageStates", JSON.stringify(updated));
        return { stageStates: updated };
      });
    },


    loadStageState: (roomId) => {
      const saved = get().stageStates[roomId];
      if (saved) return saved;

      const stored = localStorage.getItem("stageStates");
      if (!stored) return null;

      try {
        const parsed: Record<string, { x: number; y: number; scale: number }> = JSON.parse(stored);
        return parsed[roomId] || null;
      } catch {
        return null;
      }
    }
  })) as StateCreator<CanvasStore>
);
