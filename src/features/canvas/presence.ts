// Who else is in the room, from Yjs awareness.

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
