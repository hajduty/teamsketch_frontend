// Who else is in the room, from Yjs awareness.
import { AwarenessState } from "./tools/baseTool";

// Dark enough for white text on the name labels and avatars
const COLORS = ["#e5484d", "#f76b15", "#d6409f", "#8e4ec6", "#3e63dd", "#0090ff", "#12a594", "#30a46c"];

/** A stable colour per user, so they look the same to everyone and across visits. */
export const colorFor = (id: string | undefined) => {
  let hash = 0;
  for (const ch of id ?? "") hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
};

/** "jane.doe@mail.com" -> "jane.doe" */
export const displayName = (username: string | undefined) => (username ?? "Guest").split("@")[0];

/** "just now", "45 s ago", "3 min ago", "2 h ago", "4 d ago" */
export const timeAgo = (timestamp: number, now = Date.now()) => {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
};

export interface Peer {
  clientId: number;
  userId: string;
  name: string;
  email: string;
  color: string;
  // Pointer is on the canvas right now
  hasCursor: boolean;
  // There is a cursor or a view to jump to
  canJump: boolean;
}

/**
 * Everyone else in the room, one entry per user even when they have several tabs open.
 * Only this tab is left out: the same account elsewhere (another browser or device) is listed too.
 */
export const readPeers = (states: Map<number, AwarenessState>, selfClientId: number, selfUserId?: string): Peer[] => {
  const byUser = new Map<string, Peer>();
  states.forEach((state, clientId) => {
    if (clientId === selfClientId || !state?.userId) return;
    const hasCursor = !!state.cursorPosition;
    const existing = byUser.get(state.userId);
    // Prefer a tab with the pointer on the canvas, then the most recently used one
    if (existing) {
      const other = states.get(existing.clientId);
      if (existing.hasCursor && !hasCursor) return;
      if (existing.hasCursor === hasCursor && (other?.lastActive ?? 0) >= (state.lastActive ?? 0)) return;
    }
    byUser.set(state.userId, {
      clientId,
      userId: state.userId,
      name: displayName(state.username) + (state.userId === selfUserId ? " (you)" : ""),
      email: state.username,
      color: state.color ?? colorFor(state.userId),
      hasCursor,
      canJump: hasCursor || !!state.view,
    });
  });
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
};
