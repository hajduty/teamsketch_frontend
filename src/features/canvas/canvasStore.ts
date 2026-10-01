import { create, StateCreator } from 'zustand';
import * as Y from 'yjs';
import { ToolOptions } from './tools/baseTool';
import { Permissions } from "../../types/permission";
import { COMPACT_QUERY } from "../../hooks/useIsCompact";
import { Peer } from "./presence";

interface CanvasState {
  tool: string;
  options: ToolOptions;
  canUndo: boolean;
  canRedo: boolean;
  editing: boolean;
  editingId: string;
  guestRooms: Permissions[];
  stageStates: Record<string, { x: number; y: number; scale: number, backgroundColor: string, borderColor: string }>;
  toolOptionsOpen: boolean;
  // Which card the options panel shows: the active tool's options or canvas settings
  optionsPanel: 'tool' | 'canvas';
  // Current zoom, and zoom actions registered by the canvas for the zoom controls
  zoom: number;
  viewControls: { zoomIn: () => void; zoomOut: () => void; resetZoom: () => void; jumpToPeer: (clientId: number) => void; peerLastActive: (clientId: number) => number | null } | null;
  // Other people in the room, for the avatars
  peers: Peer[];
  toolbarOpen: boolean;
  roomListOpen: boolean;
  canDelete: boolean;
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
  delete: () => void;
  addGuestRoom: (state: Permissions) => void;
  removeGuestRoom: (roomId: string) => void;
  saveStageState: (roomId: string, updates: Partial<{ x: number; y: number; scale: number; backgroundColor: string, borderColor: string }>) => void;
  loadStageState: (roomId: string) => { x: number; y: number; scale: number; backgroundColor: string, borderColor: string } | null;
  setToolOptionsOpen: (state: boolean) => void;
  /** Select a tool; selecting the active tool again toggles its options */
  selectTool: (tool: string) => void;
  toggleCanvasSettings: () => void;
  setToolbarOpen: (state: boolean) => void;
  setRoomListOpen: (state: boolean) => void;
  setCanDelete: (state: boolean) => void;
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
      color: '#ececef',
      size: 5,
      opacity: 1,
      lineStyle: 'solid',
      taper: 'none',
      arrowStart: false,
      arrowEnd: false,
      stabilizer: 0,
      smartShapes: false,
      fontSize: 16,
      fontFamily: 'Arial',
    },
    roomListOpen: false,
    // Open by default, except on phones where it would cover half the canvas
    toolOptionsOpen: typeof window === 'undefined' || !window.matchMedia(COMPACT_QUERY).matches,
    optionsPanel: 'tool',
    zoom: 1,
    viewControls: null,
    peers: [],
    toolbarOpen: false,
    canUndo: false,
    canRedo: false,
    canDelete: false,
    editing: false,
    editingId: "",
    // A guest's rooms exist only on this device
    guestRooms: (() => {
      try {
        return JSON.parse(localStorage.getItem("guestRooms") || "[]");
      } catch {
        return [];
      }
    })(),
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

    removeGuestRoom: (roomId) => {
      const updatedRooms = get().guestRooms.filter((room) => room.room !== roomId);
      set({ guestRooms: updatedRooms });
      localStorage.setItem("guestRooms", JSON.stringify(updatedRooms));
    },

    setEditing: (editing) => set({ editing }),

    setEditingId: (editingId: string) => set({ editingId }),

    setRoomListOpen: (roomListOpen) => set({ roomListOpen }),

    setCanDelete: (canDelete) => set({ canDelete }),

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

    delete: () => {
      if (!(yObjects instanceof Y.Map) || !ydoc) return;
      const map = yObjects;

      Y.transact(ydoc, () => {
        map.forEach((obj, id) => {
          if (obj instanceof Y.Map && obj.get('selected')) {
            map.delete(id);
          }
        });
      });
    },

    setToolbarOpen: (toolbarOpen) => set({ toolbarOpen }),
    setToolOptionsOpen: (toolOptionsOpen) => set({ toolOptionsOpen }),

    selectTool: (tool) => {
      const { tool: current, toolOptionsOpen, optionsPanel } = get();
      if (tool === current && optionsPanel === 'tool') {
        set({ toolOptionsOpen: !toolOptionsOpen });
      } else {
        set({ tool, optionsPanel: 'tool', toolOptionsOpen: true });
      }
    },

    toggleCanvasSettings: () => {
      const { toolOptionsOpen, optionsPanel } = get();
      if (optionsPanel === 'canvas' && toolOptionsOpen) {
        set({ toolOptionsOpen: false, optionsPanel: 'tool' });
      } else {
        set({ toolOptionsOpen: true, optionsPanel: 'canvas' });
      }
    },

    saveStageState: (roomId: string, updates: Partial<{ x: number; y: number; scale: number; backgroundColor: string, borderColor: string }>) => {
      set(state => {
        const prevRoomState = state.stageStates[roomId] ?? { scale: 1, backgroundColor: "#18191c", borderColor: "#2a2c31" };

        const updated = {
          ...state.stageStates,
          [roomId]: {
            ...prevRoomState,
            ...updates, // only update what was passed in
          },
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
        const parsed: Record<string, { x: number; y: number; scale: number, backgroundColor: string }> = JSON.parse(stored);
        return parsed[roomId] || null;
      } catch {
        return null;
      }
    }
  })) as StateCreator<CanvasStore>
);
