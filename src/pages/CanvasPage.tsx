import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CanvasBoard } from "../features/canvas/Canvas";
import { Toolbar } from "../features/canvas/components/Toolbar";
import { ToolOptions } from "../features/canvas/components/ToolOptions";
import { HistoryButtons } from "../features/canvas/components/HistoryButtons";
import { ShareCanvas } from "../features/canvas/components/ShareCanvas";
import { useAuth } from "../features/auth/AuthProvider";
import { Permissions } from "../types/permission";
import { CanvasList } from "../features/canvas/components/CanvasList";
import { UserInfo } from "../features/canvas/components/UserInfo";
import { getUUID } from "../utils/utils";
import { useSignalR } from "../features/auth/ProtectedRoute";

export const CanvasWrapper = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!roomId) {
      if (location.pathname === "/") {
        const newRoomId = getUUID();
        navigate(`/${newRoomId}`, { replace: true });
      }
    }
  }, [roomId, location.pathname, navigate]);

  if (!roomId) return <></>

  return <CanvasPage roomId={roomId} />;
}

function CanvasPage({ roomId }: { roomId: string }) {
  const [permission, setPermission] = useState<Permissions>();

  const { connection } = useSignalR();

  useEffect(() => {
    let isMounted = true;

    const loadPermissions = async () => {
      while (isMounted && (!roomId || !connection)) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!isMounted || !connection || !roomId) return;

      while (isMounted && connection.state !== "Connected") {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!isMounted) return;

      try {
        const roomPerm = await connection.invoke<Permissions>("GetPermission", roomId);
        if (isMounted && roomPerm) {
          setPermission(roomPerm);
          console.log("Permissions loaded:", roomPerm);
        }
      } catch (err) {
        console.error("Failed to load permissions:", err);
      }
    };

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, [roomId, connection]);

  if (!roomId) return null;

  if (permission == null) {
    return(
    <>
      <CanvasList roomId={roomId!}/>
      <UserInfo />
      <div className="flex h-screen w-screen justify-center items-center bg-neutral-950">
        <h1 className="text-white text-2xl select-none">This room does not exist.</h1>
      </div>
    </>
    )
  }

  return (
    <>
      <div className="flex flex-row h-screen justify-center items-center bg-neutral-800 relative touch-none">
        <CanvasBoard roomId={roomId!} role={permission?.role} key={roomId} />
      </div>
      {permission?.role != "viewer" && <>
        <HistoryButtons />
        <Toolbar />
        <ToolOptions />
        <ShareCanvas roomId={roomId!} />
        <UserInfo />
      </>
      }
      <CanvasList roomId={roomId!}/>
    </>
  );
}

export default CanvasPage;
