const AUTH_URL = import.meta.env.VITE_API_AUTH_URL || "https://localhost:7154/api/";
const PERMISSION_URL = import.meta.env.VITE_API_PERMISSION_URL || "https://localhost:7122/api";
const ROOM_URL = import.meta.env.VITE_API_ROOM_URL || "https://localhost:5001/api";

export const apiRoutes = {
  auth: {
    login: `${AUTH_URL}/Auth/login`,
    register: `${AUTH_URL}/Auth/register`,
  },
  room: {
    collaboration: (roomName: string) => `${ROOM_URL}/room/collaboration/${roomName}`,
  },
  permission: {
    add: `${PERMISSION_URL}/permission`,
    remove: `${PERMISSION_URL}/permission`,
    edit: `${PERMISSION_URL}/permission`,
    getByRoom: (roomId: string) => `${PERMISSION_URL}/room/permission/${roomId}`,
    getMyRooms: `${PERMISSION_URL}/room/permission`
  }
};