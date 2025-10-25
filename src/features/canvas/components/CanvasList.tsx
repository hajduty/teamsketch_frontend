import { FC, useEffect, useState } from "react";
import apiClient from "../../../lib/apiClient";
import { apiRoutes } from "../../../lib/apiRoutes";
import Icon from "../../../components/Icon";
import { useAuth } from "../../auth/AuthProvider";
import { useCanvasStore } from "../canvasStore";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
import { NewRoomButton } from "../../../components/NewRoomButton";
import { useSignalR } from "../../auth/ProtectedRoute";
import { Permissions } from "../../../types/permission";
import { DeletePopup } from "./DeletePopup";

var cooldownMs = 1000;

export const CanvasList: FC<{ roomId: string }> = ({ roomId }) => {
  const navigate = useNavigate();
  const { guest, user } = useAuth();
  const { guestRooms } = useCanvasStore();
  const { connection } = useSignalR();

  const [rooms, setRooms] = useState<Permissions[]>([]);

  const collapsed = useCanvasStore(state => state.roomListOpen);
  const setCollapsed = useCanvasStore(state => state.setRoomListOpen);

  const [creating, setCreating] = useState<boolean>(false);
  const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Permissions | null>(null);

  const fetchRooms = async () => {
    if (guest) {
      setRooms(guestRooms);
      return;
    }

    while (!connection || connection.state !== "Connected") {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!connection) return;

    try {
      const response = await connection.invoke<Permissions[]>("GetRooms");
      setRooms(response);
    } catch (err: any) {
      console.error("Failed to fetch rooms", err);
    }
  };

  useEffect(() => {
    const setupRoomListeners = async () => {
      await fetchRooms();

      if (!connection) return;

      connection.on("PermissionChanged", (updatedRoom: Permissions) => {
        if (!updatedRoom) return;
        setRooms(prev => prev.filter(r => r.room !== updatedRoom.room));
      });

      connection.on("PermissionAdded", (updatedRoom: Permissions) => {
        if (!updatedRoom) return;

        updatedRoom.createdAt = new Date();
        updatedRoom.userId = user?.id!;
        updatedRoom.userEmail = user?.email!;

        setRooms(prev => {
          const exists = prev.some(r => r.room === updatedRoom.room);
          return exists ? prev : [...prev, updatedRoom];
        });
      });
    };

    setupRoomListeners();
  }, [connection, guest, guestRooms, user?.id, user?.email]);


  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const createNewRoom = async () => {
    setCreating(true);
    try {
      const uuid = uuidv4();
      const permission: Permissions = {
        role: "Owner",
        room: uuid,
        userId: user?.id!,
        userEmail: user?.email!
      };

      const response = await apiClient.post(apiRoutes.permission.add, permission);
      const newRoom: Permissions = response.data;

      setTimeout(() => {
        setRooms(prev => {
          const exists = prev.some(r => r.room === newRoom.room);
          return exists ? prev : [...prev, newRoom];
        });
      }, 1000);

      return newRoom.room;
    } catch (err: any) {
      console.error("Failed to create room:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePopup = (room: Permissions) => {
    setSelectedRoom(room);
    setIsDeletePopupOpen(true);
    fetchRooms();
  };

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
      <div className="fixed w-64 top-0 left-0 hover:z-3 z-2 m-4 canvas-list">
        <div className={`border border-neutral-700 bg-neutral-950 rounded-md overflow-hidden hover:overflow-y-auto`}>
          <div className="bg-neutral-950 py-3 pl-2 pr-1 text-white space-y-2">
            <div
              onClick={toggleCollapse}
              className="flex items-center cursor-pointer select-none font-semibold text-sm"
            >
              <Icon iconName={collapsed ? "expand_more" : "expand_less"} color="white" />
              <span>My rooms</span>
            </div>

            {(
              <>
                <div
                  className={`overflow-hidden transition-all duration-150 ease-in-out ${collapsed ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
                    }`}>
                  {rooms.length === 0 ? (<>
                    <NewRoomButton createNewRoom={createNewRoom} creating={creating} cooldownMs={cooldownMs} />
                  </>
                  ) : (
                    <ul className="space-y-2 max-h-96 overflow-auto scrollbar-thin pr-1 pl-2">
                      <NewRoomButton createNewRoom={createNewRoom} creating={creating} cooldownMs={cooldownMs} />
                      {rooms.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                        .map((perm, index) => (
                          <li
                            key={perm.room}
                            className={`flex justify-between items-center border border-neutral-700 rounded p-2 hover:bg-neutral-800 transition-all duration-300 ease-out transform group ${perm.room == roomId ? "bg-neutral-900" : ""
                              } ${index === 0 ? "animate-slide-in" : ""
                              }`}
                            style={{
                              animation: index === 0 ? 'slideIn 0.3s ease-out' : 'none'
                            }}
                          >
                            <div className="flex flex-col min-w-0 flex-1 mr-2">
                              <span className="text-sm break-all select-none text-neutral-400">
                                Room ID:
                              </span>
                              <span className="font-medium text-sm break-all">
                                {perm.room}
                              </span>
                              <span className="text-sm text-neutral-400">
                                {perm.role}
                              </span>
                            </div>
                            <button
                              onClick={() => navigate(`/${perm.room}`)}
                              className="text-blue-400 text-sm flex items-center gap-1 flex-shrink-0 cursor-pointer"
                            >
                              <Icon iconName="arrow_forward" fontSize="20px" color="white" />
                            </button>

                            <button
                              onClick={() => handleDeletePopup(perm)}
                              className="absolute bottom-1 right-2 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-red-600 text-neutral-600"
                            >
                              <Icon iconName="delete" fontSize="20px" />
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
