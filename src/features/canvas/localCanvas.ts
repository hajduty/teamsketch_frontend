// Canvases saved in localStorage: the only copy of a guest's canvases, and an offline cache
// of an account's rooms (changes made offline sync to the server when it's back).
import * as Y from "yjs";
import { Permissions } from "../../types/permission";

/** Origin of updates loaded from this device, so they aren't undoable or re-saved. */
export const LOCAL_ORIGIN = "local-storage";

const PREFIX = "canvas:";
const PERMISSION_PREFIX = "canvas-permission:";
const INDEX_KEY = "canvas-index"; // storage key -> last saved (ms), for evicting old caches
const SAVE_DELAY_MS = 400;
export const GUEST_OWNER = "guest";

// Whose canvases these are: one namespace per account, plus one for guests
const storageKey = (owner: string, roomId: string) => `${PREFIX}${owner}:${roomId}`;

const readIndex = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || "{}");
  } catch {
    return {};
  }
};

const writeIndex = (index: Record<string, number>) => {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // The index only orders evictions; losing an update is harmless
  }
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const fromBase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

/** Apply the saved copy of a room to `doc`. Returns whether there was one. */
export const loadLocalCanvas = (owner: string, roomId: string, doc: Y.Doc) => {
  const saved = localStorage.getItem(storageKey(owner, roomId));
  if (!saved) return false;
  try {
    Y.applyUpdate(doc, fromBase64(saved), LOCAL_ORIGIN);
    return true;
  } catch (err) {
    console.warn("Ignoring unreadable saved canvas", roomId, err);
    return false;
  }
};

/**
 * Write one room. When storage is full, drops the least recently saved account caches
 * (they're also on the server) until it fits; guest canvases are never evicted.
 */
const saveLocalCanvas = (owner: string, roomId: string, doc: Y.Doc) => {
  const key = storageKey(owner, roomId);
  const value = toBase64(Y.encodeStateAsUpdate(doc));
  const index = readIndex();
  for (;;) {
    try {
      localStorage.setItem(key, value);
      index[key] = Date.now();
      writeIndex(index);
      return true;
    } catch {
      const evictable = Object.entries(index)
        .filter(([k]) => k !== key && !k.startsWith(`${PREFIX}${GUEST_OWNER}:`))
        .sort((a, b) => a[1] - b[1]);
      if (evictable.length === 0) {
        console.warn("Not enough storage to save the canvas on this device", roomId);
        return false;
      }
      localStorage.removeItem(evictable[0][0]);
      delete index[evictable[0][0]];
    }
  }
};

/**
 * Keep the saved copy up to date with `doc`: shortly after each change, and when the page
 * is hidden or closed. Returns a function that saves pending changes and stops.
 */
export const bindLocalCanvas = (owner: string, roomId: string, doc: Y.Doc, onSaved?: (ok: boolean) => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!dirty) return;
    dirty = false;
    onSaved?.(saveLocalCanvas(owner, roomId, doc));
  };
  const onUpdate = (_update: Uint8Array, origin: unknown) => {
    if (origin === LOCAL_ORIGIN) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  };
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  doc.on("update", onUpdate);
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  return () => {
    flush();
    doc.off("update", onUpdate);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
  };
};

export const removeLocalCanvas = (owner: string, roomId: string) => {
  const key = storageKey(owner, roomId);
  localStorage.removeItem(key);
  const index = readIndex();
  delete index[key];
  writeIndex(index);
};

/** Remember an account's access to a room, so the room opens while the server is unreachable. */
export const saveRoomPermission = (owner: string, permission: Permissions) => {
  try {
    localStorage.setItem(`${PERMISSION_PREFIX}${owner}:${permission.room}`, JSON.stringify(permission));
  } catch {
    // Without it the room just needs the server to open
  }
};

export const loadRoomPermission = (owner: string, roomId: string): Permissions | null => {
  try {
    return JSON.parse(localStorage.getItem(`${PERMISSION_PREFIX}${owner}:${roomId}`) || "null");
  } catch {
    return null;
  }
};

/** Remove every room (and remembered access) saved for `owner`, e.g. an account logging out. */
export const clearLocalCanvases = (owner: string) => {
  const prefixes = [`${PREFIX}${owner}:`, `${PERMISSION_PREFIX}${owner}:`];
  const index = readIndex();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && prefixes.some(prefix => key.startsWith(prefix))) {
      localStorage.removeItem(key);
      delete index[key];
    }
  }
  writeIndex(index);
};
