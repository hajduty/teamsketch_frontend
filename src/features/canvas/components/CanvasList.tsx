import { FC, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "../../../lib/apiClient";
import { apiRoutes } from "../../../lib/apiRoutes";
import Icon from "../../../components/Icon";
import { NewRoomButton } from "../../../components/NewRoomButton";
import { DeletePopup } from "./DeletePopup";

import { useAuth } from "../../auth/AuthProvider";
import { useSignalR } from "../../auth/ProtectedRoute";
import { useCanvasStore } from "../canvasStore";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { Permissions } from "../../../types/permission";
import React from "react";
import { generateRoomId } from "../../../utils/utils";

const cooldownMs = 1000;

const CanvasListComponent: FC<{ roomId: string }> = ({ roomId }) => {
  const navigate = useNavigate();
  const { guest, user } = useAuth();
  const { guestRooms } = useCanvasStore();
  const { connection } = useSignalR();
  const isMobile = useIsMobile();

  const collapsed = useCanvasStore(state => state.roomListOpen);
  const setCollapsed = useCanvasStore(state => state.setRoomListOpen);

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

  const toggleCollapse = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);

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

  const RoomItem: FC<{ perm: Permissions; index: number }> = useCallback(
    ({ perm, index }) => (
      <li
        key={perm.room}
        className={`relative flex justify-between items-center border border-neutral-700 rounded p-2 hover:bg-neutral-800 transition-all duration-300 ease-out transform group ${
          perm.room === roomId ? "bg-neutral-900" : ""
        } ${index === 0 ? "animate-slide-in" : ""}`}
        style={{ animation: index === 0 ? "slideIn 0.3s ease-out" : "none" }}
      >
        <div className="flex flex-col min-w-0 flex-1 mr-2">
          <span className="text-sm break-all select-none text-neutral-400">Room ID:</span>
          <span className="font-medium text-sm break-all">{perm.room}</span>
          <span className="text-sm text-neutral-400">{perm.role}</span>
        </div>
        <button
          onClick={() => navigate(`/${perm.room}`)}
          className="text-blue-400 text-sm flex items-center gap-1 flex-shrink-0 cursor-pointer"
        >
          <Icon iconName="arrow_forward" fontSize="20px" color="white" />
        </button>
        <button
          onClick={() => handleDeletePopup(perm)}
          className={`absolute bottom-1 right-2 cursor-pointer ${
            isMobile ? "opacity-100" : "opacity-0"
          } group-hover:opacity-100 transition-opacity duration-200 hover:text-red-600 text-neutral-600`}
        >
          <Icon iconName="delete" fontSize="20px" />
        </button>
      </li>
    ),
    [handleDeletePopup, isMobile, navigate, roomId]
  );

  const content = useMemo(() => {
    return (
      <div className="fixed top-0 left-0 hover:z-3 z-2 m-4 canvas-list">
        <div
          className={`border border-t-zinc-700 border-zinc-800 bg-neutral-950 rounded-md ${
            isMobile
              ? `transition-all duration-300 ease-in-out ${
                  collapsed ? "w-10 overflow-hidden" : "w-64 overflow-hidden hover:overflow-y-auto"
                }`
              : "w-64 overflow-hidden hover:overflow-y-auto"
          }`}
        >
          <div className={`bg-neutral-950 py-2 pl-2 pr-2 text-white`}>
            <div
              onClick={toggleCollapse}
              className={`flex justify-start items-center cursor-pointer select-none font-semibold text-sm ${
                isMobile ? "whitespace-nowrap" : ""
              }`}
            >
              <Icon iconName={collapsed ? "expand_more" : "expand_less"} color="white" />
              <span
                className={`transition-all duration-300 ease-in-out ${
                  isMobile ? (collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto") : ""
                }`}
              >
                My rooms
              </span>
            </div>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                collapsed ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
              }`}
            >
              <div
                className={
                  isMobile
                    ? `transition-opacity duration-200 ${collapsed ? "opacity-0" : "opacity-100 delay-150"}`
                    : ""
                }
              >
                {sortedRooms.length === 0 ? (
                  <NewRoomButton createNewRoom={createNewRoom} creating={creating} cooldownMs={cooldownMs} />
                ) : (
                  <ul className="space-y-2 max-h-96 overflow-auto scrollbar-thin pr-1 pl-2">
                    <NewRoomButton createNewRoom={createNewRoom} creating={creating} cooldownMs={cooldownMs} />
                    {sortedRooms.map((perm, index) => (
                      <RoomItem key={perm.room} perm={perm} index={index} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [collapsed, createNewRoom, isMobile, sortedRooms, RoomItem, toggleCollapse, creating]);

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