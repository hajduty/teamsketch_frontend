import { create, StateCreator } from 'zustand';
import * as Y from 'yjs';
import { CanvasObject, ToolOptions } from './tools/baseTool';
import { Permissions } from "../../types/permission";
import { COMPACT_QUERY } from "../../hooks/useIsCompact";
import { Peer } from "./presence";
import { LibraryItem, readLibrary, writeLibrary } from "./assets/library";
import { ASSETS, getAsset } from "./assets/catalog";

type Point = { x: number; y: number };

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
  viewControls: {
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    jumpToPeer: (clientId: number) => void;
    peerLastActive: (clientId: number) => number | null;
    // Canvas point in the middle of the screen, and the canvas point under a screen position
    center: () => Point;
    clientToCanvas: (clientX: number, clientY: number) => Point | null;
  } | null;
  // Other people in the room, for the avatars
  peers: Peer[];
  toolbarOpen: boolean;
  roomListOpen: boolean;
  canDelete: boolean;
  // Category of the library shape added or changed last, for "similar shapes" in the
  // right-click menu
  recentCategory: string;
  libraryOpen: boolean;
  // Saved library items of whoever is signed in (or the guest)
  libraryOwner: string | null;
  libraryItems: LibraryItem[];
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
  noteAssetUsed: (assetId: string) => void;
  setLibraryOpen: (state: boolean) => void;
  loadLibrary: (owner: string) => void;
  /** Returns false when it couldn't be saved (storage full) */
  addLibraryItem: (item: LibraryItem) => boolean;
  removeLibraryItem: (id: string) => void;
  /** Add objects to the canvas; with `select`, they become the selection */
  insertObjects: (objects: CanvasObject[], select?: boolean) => void;
  updateObject: (id: string, props: Partial<CanvasObject>) => void;
  selectedObjects: () => CanvasObject[];
  /** Shape type of a placed library shape */
  objectAssetId: (id: string) => string | undefined;
}

type CanvasStore = CanvasState & CanvasActions;

/**
 * Whose library to use: the one the canvas loaded, or else whoever is signed in according to
 * the stored session (so saving never depends on the canvas having loaded it first).
 */
const ensureLibraryOwner = (get: () => CanvasStore, set: (state: Partial<CanvasStore>) => void) => {
  const loaded = get().libraryOwner;
  if (loaded) return loaded;
  let owner: string | null = null;
  try {
    owner = localStorage.getItem('token') === 'none'
      ? 'guest'
      : JSON.parse(localStorage.getItem('user') || 'null')?.id ?? null;
  } catch {
    owner = null;
  }
  if (owner) set({ libraryOwner: owner, libraryItems: readLibrary(owner) });
  return owner;
};

let ydoc: Y.Doc | null = null;

let yObjects: Y.Map<any> | null = null;
let undoManager: Y.UndoManager | null = null;

/**
 * Deselect everything, e.g. when switching tools: a selection left behind stays draggable and
 * a pen stroke over it would move it too. Not an undoable change (undo tracks only
 * transactions without an origin).
 */
const clearSelection = (set: (state: Partial<CanvasStore>) => void) => {
  if (!yObjects || !ydoc) return;
  const map = yObjects;
  Y.transact(ydoc, () => {
    map.forEach(obj => { if (obj instanceof Y.Map && obj.get('selected')) obj.set('selected', false); });
  }, 'selection');
  set({ canDelete: false });
};

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
    recentCategory: ASSETS[0].category,
    libraryOpen: false,
    libraryOwner: null,
    libraryItems: [],
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

    setTool: (tool) => {
      if (tool !== get().tool) clearSelection(set);
      set({ tool });
    },

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

    noteAssetUsed: (assetId) => {
      const asset = getAsset(assetId);
      if (asset) set({ recentCategory: asset.category });
    },

    setLibraryOpen: (libraryOpen) => {
      if (libraryOpen) ensureLibraryOwner(get, set);
      set({ libraryOpen });
    },

    loadLibrary: (owner) => {
      if (get().libraryOwner === owner) return;
      set({ libraryOwner: owner, libraryItems: readLibrary(owner) });
    },

    addLibraryItem: (item) => {
      const libraryOwner = ensureLibraryOwner(get, set);
      const { libraryItems } = get();
      if (!libraryOwner) return false;
      const items = [item, ...libraryItems];
      if (!writeLibrary(libraryOwner, items)) return false;
      set({ libraryItems: items });
      return true;
    },

    removeLibraryItem: (id) => {
      const libraryOwner = ensureLibraryOwner(get, set);
      const { libraryItems } = get();
      if (!libraryOwner) return;
      const items = libraryItems.filter(item => item.id !== id);
      writeLibrary(libraryOwner, items);
      set({ libraryItems: items });
    },

    insertObjects: (objects, select = false) => {
      if (!yObjects || !ydoc || objects.length === 0) return;
      const map = yObjects;
      Y.transact(ydoc, () => {
        if (select) map.forEach(obj => { if (obj instanceof Y.Map && obj.get('selected')) obj.set('selected', false); });
        for (const { id, ...props } of objects) {
          const yObj = new Y.Map<unknown>();
          yObj.set('id', id);
          for (const [key, value] of Object.entries(props)) {
            if (key === 'selected' || value === undefined) continue;
            // Point lists are Y.Arrays, like the ones the pen creates
            yObj.set(key, Array.isArray(value) ? Y.Array.from(value) : value);
          }
          if (select) yObj.set('selected', true);
          map.set(id, yObj);
        }
      });
      if (select) set({ canDelete: true });
    },

    updateObject: (id, props) => {
      const yObj = yObjects?.get(id);
      if (!(yObj instanceof Y.Map) || !ydoc) return;
      Y.transact(ydoc, () => {
        for (const [key, value] of Object.entries(props)) {
          if (value === undefined) yObj.delete(key);
          else yObj.set(key, value);
        }
      });
    },

    objectAssetId: (id) => {
      const yObj = yObjects?.get(id);
      return yObj instanceof Y.Map ? yObj.get('assetId') : undefined;
    },

    selectedObjects: () => {
      const selected: CanvasObject[] = [];
      yObjects?.forEach((value, id) => {
        if (!(value instanceof Y.Map) || !value.get('selected')) return;
        const plain: CanvasObject = { id, type: value.get('type') };
        value.forEach((v, key) => { plain[key] = v instanceof Y.Array ? v.toArray() : v; });
        selected.push(plain);
      });
      return selected;
    },

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
        if (tool !== current) clearSelection(set);
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
