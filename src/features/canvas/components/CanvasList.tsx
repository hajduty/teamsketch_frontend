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

var cooldownMs = 1000;

export const CanvasList: FC<{roomId: string}> = ({roomId}) => {
  const navigate = useNavigate();
  const { guest, user } = useAuth();
  const { guestRooms } = useCanvasStore();
  const { connection } = useSignalR();

  const [rooms, setRooms] = useState<Permissions[]>([]);
  const [collapsed, setCollapsed] = useState(true);
  const [creating, setCreating] = useState<boolean>(false);

  useEffect(() => {
    const fetchRooms = async () => {
      if (guest) {
        setRooms(guestRooms);
        return;
      }

      while (!connection || connection.state !== "Connected") {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!connection) return;

      connection.on("PermissionChanged", (updatedRoom: Permissions) => {
        console.log("Permission changed", updatedRoom);
      });

      connection.on("PermissionAdded", (updatedRoom: Permissions) => {
        console.log("Permission added", updatedRoom);
      });

      try {
        const response = await connection.invoke<Permissions[]>("GetRooms");
        setRooms(response);
      } catch (err: any) {
        console.error("Failed to fetch rooms", err);
      }
    }
  
    fetchRooms();
  }, [connection])

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const createNewRoom = async () => {
    setCreating(true);
    try {
      var uuid = uuidv4();
      console.log("Generated UUID:", uuid);
      var permission: Permissions = { role: "Owner", room: uuid, userId: user?.id!, userEmail: user?.email! }
      console.log(permission);
      const response = await apiClient.post(apiRoutes.permission.add, permission);
      console.log(response);
      var room: Permissions = response.data;
      setTimeout(() => {
        setRooms(prev => [...prev, room]);
      }, cooldownMs);
      setCreating(false);
      return room.room;
    } catch (err: any) {
      setCreating(false);
    }
  }

  return (
    <div className="fixed top-0 left-0 group hover:z-3 z-2 m-4 ">
      <div className="w-64 border border-neutral-700 bg-neutral-950 rounded-md overflow-hidden hover:overflow-y-auto">
        <div className=" bg-neutral-950 py-3 pl-2 pr-1 text-white space-y-2">

          {/* Collapsible Header */}
          <div
            onClick={toggleCollapse}
            className="flex items-center cursor-pointer select-none font-semibold text-sm"
          >
            <Icon iconName={collapsed ? "expand_more" : "expand_less"} color="white" />
            <span>My rooms</span>
          </div>

          {/* Collapsible content */}
          {(
            <>
              <div
                className={`overflow-hidden transition-all duration-150 ease-in-out ${collapsed ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
                  }`}>
                {/* New Room Button */}
                {rooms.length === 0 ? (<>
                  <NewRoomButton createNewRoom={createNewRoom} creating={creating} cooldownMs={cooldownMs} />
                </>
                ) : (
                  <ul className="space-y-2 max-h-96 overflow-auto scrollbar-thin pr-1 pl-2">
                    <NewRoomButton createNewRoom={createNewRoom} creating={creating} cooldownMs={cooldownMs} />
                    {rooms.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                    .map((perm) => (
                      <li
                        key={perm.room}
                        className={`flex justify-between items-center border border-neutral-700 rounded p-2 hover:bg-neutral-800 transition ${perm.room == roomId ? "bg-neutral-900" : ""}`}
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div >
  );
};
