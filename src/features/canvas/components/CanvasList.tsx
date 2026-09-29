import { FC, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "../../../lib/apiClient";
import { apiRoutes } from "../../../lib/apiRoutes";
import Icon from "../../../components/Icon";
import { DeletePopup } from "./DeletePopup";

import { useAuth } from "../../auth/AuthProvider";
import { useSignalR } from "../../auth/ProtectedRoute";
import { useCanvasStore } from "../canvasStore";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useIsCompact } from "../../../hooks/useIsCompact";
import { Permissions } from "../../../types/permission";
import React from "react";
import { generateRoomId } from "../../../utils/utils";

/** "Frozen-Mirror-37363P" -> { name: "Frozen Mirror", code: "37363P" } */
const parseRoomId = (id: string) => {
  const parts = id.split("-");
  if (parts.length >= 3 && /^[A-Z0-9]{4,}$/.test(parts[parts.length - 1])) {
    return { name: parts.slice(0, -1).join(" "), code: parts[parts.length - 1] };
  }
  return { name: id, code: "" };
};

/** A stable colour per room, so rooms are recognisable at a glance */
const roomHue = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
};

const RoomChip: FC<{ id: string; size?: "sm" | "md" }> = ({ id, size = "md" }) => {
  const { name } = parseRoomId(id);
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const hue = roomHue(id);
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center rounded-md font-semibold text-white/95 flex-shrink-0
        ${size === "sm" ? "size-6 text-[10px]" : "size-7 text-[11px]"}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 62% 52%), hsl(${(hue + 40) % 360} 58% 40%))` }}
    >
      {initials}
    </span>
  );
};

const relativeTime = (date?: Date | string) => {
  if (!date) return "";
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
};

const CanvasListComponent: FC<{ roomId: string }> = ({ roomId }) => {
  const navigate = useNavigate();
  const { guest, user } = useAuth();
  const { guestRooms } = useCanvasStore();
  const { connection } = useSignalR();
  const isMobile = useIsMobile();
  const compact = useIsCompact();

  const open = useCanvasStore(state => state.roomListOpen);
  const setOpen = useCanvasStore(state => state.setRoomListOpen);
  const rootRef = useRef<HTMLDivElement>(null);

  const [rooms, setRooms] = useState<Permissions[]>([]);
  const [creating, setCreating] = useState(false);
  const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Permissions | null>(null);
  
  const handlersRegistered = useRef(false);

  const fetchRooms = useCallback(async () => {
    if (guest) {
      setRooms(guestRooms);
      return;
    }

    while (!connection || connection.state !== "Connected") {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const response = await connection?.invoke<Permissions[]>("GetRooms");
      if (response) setRooms(response);
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    }
  }, [guest, guestRooms, connection]);

  useEffect(() => {
    if (!connection || handlersRegistered.current) return;

    fetchRooms();

    // Use functional updates to avoid stale closures
    const handlePermissionChanged = (updatedRoom: Permissions) => {
      if (!updatedRoom) return;
      console.log("PermissionChanged:", updatedRoom.room);
      
      setRooms(prev => {
        const filtered = prev.filter(r => r.room !== updatedRoom.room);
        if (filtered.length !== prev.length) {
          console.log("Room removed from list:", updatedRoom.room);
        }
        return filtered;
      });
    };

    const handlePermissionAdded = (updatedRoom: Permissions) => {
      if (!updatedRoom || !updatedRoom.room) {
        console.warn("PermissionAdded received invalid data:", updatedRoom);
        return;
      }
      console.log("PermissionAdded:", updatedRoom.room);

      setRooms(prev => {
        const exists = prev.some(r => r.room === updatedRoom.room);
        if (exists) {
          console.log("Room already exists, skipping:", updatedRoom.room);
          return prev;
        }
        
        console.log("Adding new room to list:", updatedRoom.room);
        return [...prev, {
          ...updatedRoom,
          createdAt: updatedRoom.createdAt || new Date(),
          userId: updatedRoom.userId || user?.id!,
          userEmail: updatedRoom.userEmail || user?.email!,
        }];
      });
    };

    connection.on("PermissionChanged", handlePermissionChanged);
    connection.on("PermissionAdded", handlePermissionAdded);
    handlersRegistered.current = true;

    return () => {
      connection.off("PermissionChanged", handlePermissionChanged);
      connection.off("PermissionAdded", handlePermissionAdded);
      handlersRegistered.current = false;
    };
  }, [connection, fetchRooms, user?.id, user?.email]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  const createNewRoom = useCallback(async () => {
    setCreating(true);
    try {
      const uuid = generateRoomId();
      const permission: Permissions = {
        role: "Owner",
        room: uuid,
        userId: user?.id!,
        userEmail: user?.email!,
      };

      const response = await apiClient.post(apiRoutes.permission.add, permission);
      const newRoom: Permissions = response.data;

      console.log("Room created, waiting for SignalR event:", newRoom.room);

      return newRoom.room;
    } catch (err) {
      console.error("Failed to create room:", err);
    } finally {
      setCreating(false);
    }
  }, [user?.id, user?.email]);

  const handleDeletePopup = useCallback(
    (room: Permissions) => {
      setSelectedRoom(room);
      setIsDeletePopupOpen(true);
      fetchRooms();
    },
    [fetchRooms]
  );

  const sortedRooms = useMemo(
    () =>
      rooms
        .slice()
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()),
    [rooms]
  );

  const handleNewRoom = useCallback(async () => {
    const id = await createNewRoom();
    if (id) {
      setOpen(false);
      navigate(`/${id}`);
    }
  }, [createNewRoom, navigate, setOpen]);

  const current = parseRoomId(roomId);

  const content = (
    <div ref={rootRef} className="canvas-list fixed z-30 top-3 left-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="room-switcher-trigger island flex items-center gap-2.5 h-11 pl-2 pr-2.5 cursor-pointer hover:bg-raised transition-colors max-w-[min(360px,calc(100vw-150px))]"
      >
        <RoomChip id={roomId} />
        <span className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium text-ink truncate">{current.name}</span>
          {current.code && !compact && <span className="text-xs text-ink-faint tabular">{current.code}</span>}
        </span>
        <Icon iconName="unfold_more" fontSize="18px" className="text-ink-muted" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Your rooms"
          className="island absolute left-0 mt-2 w-[min(340px,calc(100vw-24px))] overflow-hidden"
        >
          <div className="flex items-center justify-between pl-3.5 pr-2 h-11 border-b border-line">
            <span className="text-xs font-medium text-ink-faint">Your rooms</span>
            <button
              type="button"
              onClick={handleNewRoom}
              disabled={creating}
              className="flex items-center gap-1 h-7 pl-1.5 pr-2.5 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-xs font-medium cursor-pointer transition-colors"
            >
              <Icon iconName="add" fontSize="16px" />
              {creating ? "Creating…" : "New room"}
            </button>
          </div>

          {sortedRooms.length === 0 ? (
            <p className="px-3.5 py-6 text-sm text-ink-muted text-center">
              No rooms yet. Create one to start drawing.
            </p>
          ) : (
            <ul className="max-h-[min(420px,60dvh)] overflow-y-auto scrollbar-thin p-1.5">
              {sortedRooms.map((perm) => {
                const { name, code } = parseRoomId(perm.room);
                const isCurrent = perm.room === roomId;
                return (
                  <li key={perm.room} className="group relative">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setOpen(false); navigate(`/${perm.room}`); }}
                      className={`w-full flex items-center gap-3 pl-2 pr-10 py-2 rounded-lg text-left cursor-pointer transition-colors
                        ${isCurrent ? "bg-raised" : "hover:bg-raised/60"}`}
                    >
                      <RoomChip id={perm.room} size="sm" />
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="flex items-baseline gap-2 min-w-0">
                          <span className="text-sm text-ink truncate">{name}</span>
                          {code && <span className="text-[11px] text-ink-faint tabular">{code}</span>}
                        </span>
                        <span className="text-xs text-ink-faint">
                          {perm.role}{perm.createdAt ? `, created ${relativeTime(perm.createdAt)}` : ""}
                        </span>
                      </span>
                      {isCurrent && <Icon iconName="check" fontSize="18px" className="text-[#8fb0ff]" />}
                    </button>
                    {!isCurrent && (
                      <button
                        type="button"
                        aria-label={`Delete ${name}`}
                        title="Delete room"
                        onClick={() => handleDeletePopup(perm)}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center size-7 rounded-md text-ink-faint hover:text-danger hover:bg-danger/10 cursor-pointer transition-opacity
                          ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
                      >
                        <Icon iconName="delete" fontSize="18px" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <DeletePopup
        isOpen={isDeletePopupOpen}
        onClose={() => {
          setIsDeletePopupOpen(false);
          setSelectedRoom(null);
        }}
        room={selectedRoom!}
      />
      {content}
    </>
  );
};

export const CanvasList = React.memo(CanvasListComponent);