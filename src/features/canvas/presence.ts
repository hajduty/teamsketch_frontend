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

export interface Peer {
  clientId: number;
  userId: string;
  name: string;
  email: string;
  color: string;
  hasCursor: boolean;
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
    // Prefer a tab that has a cursor on the canvas, so there is somewhere to jump to
    if (existing && (existing.hasCursor || !hasCursor)) return;
    byUser.set(state.userId, {
      clientId,
      userId: state.userId,
      name: displayName(state.username) + (state.userId === selfUserId ? " (you)" : ""),
      email: state.username,
      color: state.color ?? colorFor(state.userId),
      hasCursor,
    });
  });
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
};
