import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CanvasBoard } from "../../features/canvas/Canvas";
import { Toolbar } from "../../features/canvas/components/Toolbar";
import { ToolOptions } from "../../features/canvas/components/ToolOptions";
import { HistoryButtons } from "../../features/canvas/components/HistoryButtons";
import { ShareCanvas } from "../../features/canvas/components/ShareCanvas";
import { Permissions } from "../../types/permission";
import { CanvasList } from "../../features/canvas/components/CanvasList";
import { UserInfo } from "../../features/canvas/components/UserInfo";
import { Presence } from "../../features/canvas/components/Presence";
import { useSignalR } from "../../features/auth/ProtectedRoute";

import Joyride, { Step, STATUS, CallBackProps } from "react-joyride";
import { useCanvasStore } from "../../features/canvas/canvasStore";
import { IconButton } from "../../components/IconButton";
import { SelectionBar } from "../../features/canvas/components/SelectionBar";
import apiClient from "../../lib/apiClient";
import { useAuth } from "../../features/auth/AuthProvider";
import { apiRoutes } from "../../lib/apiRoutes";
import { generateRoomId } from "../../utils/utils";
import { RoomNotFound } from "./RoomNotFound";
import { ErrorPage } from "../ErrorPage";
import { loadRoomPermission, saveRoomPermission } from "../../features/canvas/localCanvas";

// How long to wait for the server before opening a room with the access remembered from last time
const OFFLINE_FALLBACK_MS = 3000;
const lastRoomKey = (userId: string) => `lastRoom:${userId}`;

export const CanvasWrapper = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const createNewRoom = async (): Promise<string | undefined> => {
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

      return newRoom.room;
    } catch (err) {
    }
  };

  useEffect(() => {
    const ensureRoomExists = async () => {
      if (!roomId && location.pathname === "/" && user?.id) {
        try {
          const response = await apiClient.get(apiRoutes.permission.getMyRooms(user.id));
          const myRooms: Permissions[] = response.data;

          if (myRooms && myRooms.length > 0) {
            navigate(`/${myRooms[0].room}`, { replace: true });
          } else {
            const newRoomId = await createNewRoom();
            if (newRoomId) {
              navigate(`/${newRoomId}`, { replace: true });
            }
          }
        } catch (error) {
          console.error("Failed to fetch user rooms:", error);
          // Offline: reopen the last room
          const last = localStorage.getItem(lastRoomKey(user.id));
          if (last) navigate(`/${last}`, { replace: true });
        }
      }
    };

    ensureRoomExists();
  }, [roomId, location.pathname, navigate, user?.id]);

  if (!roomId) {
    return (
      <ErrorPage/>
    );
  }

  return <CanvasPage roomId={roomId} />;
};


function CanvasPage({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<Permissions>();
  const { connection } = useSignalR();
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState(false);
  const [steps] = useState<Step[]>([
    {
      target: ".toolbar",
      content: "These are your tools. Click the active tool again to show or hide its options.",
      placement: "right",
      disableBeacon: true
    },
    {
      target: ".pen-tool",
      content: "The pen is your main tool for drawing.",
      disableBeacon: true
    },
    {
      target: ".pen-options",
      content: "Change the settings of the selected tool here.",
      placement: "right",
      disableBeacon: true
    },
    {
      target: ".history-buttons",
      content: "Undo, redo and zoom. Ctrl+Z and Ctrl+Y work too.",
      placement: "top",
      disableBeacon: true
    },
    {
      target: ".canvas-list",
      content: "Switch between your rooms or create a new one.",
      placement: "bottom",
    },
    {
      target: ".share-canvas",
      content: "Invite others to draw with you.",
      placement: "bottom",
    }
  ]);
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { index, action, status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem("hasSeenCanvasTour", "true");
    }

    if (action === "next" || action === "start") {
      switch (index) {
        case 1:
          useCanvasStore.setState({ tool: "pen", optionsPanel: "tool", toolOptionsOpen: true });
          break;
        case 3:
          useCanvasStore.getState().setRoomListOpen(true);
          break;
        case 4:
          useCanvasStore.getState().setRoomListOpen(false);
          break;
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    // If the server is unreachable, open the room with the access we had last time
    const cached = user?.id ? loadRoomPermission(user.id, roomId) : null;
    const fallback = cached
      ? setTimeout(() => {
        if (!isMounted) return;
        setPermission(current => current ?? cached);
        setLoading(false);
      }, OFFLINE_FALLBACK_MS)
      : undefined;

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
        clearTimeout(fallback);
        if (isMounted && roomPerm) {
          setPermission(roomPerm);
          if (user?.id) {
            saveRoomPermission(user.id, roomPerm);
            localStorage.setItem(lastRoomKey(user.id), roomId);
          }
        } else {
          setPermission(null!);
        }
      } catch (err) {
        console.error("Failed to load permissions:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPermissions();

    return () => {
      isMounted = false;
      clearTimeout(fallback);
    };
  }, [roomId, connection, user]);

  if (!roomId) return null;

    if (loading) {
    return (
      <div className="h-screen w-screen flex justify-center items-center bg-canvas">
        <svg
          className="h-4 w-4 text-white animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      </div>
    )
  }

  if (!permission) {
    return (
      <>
        <RoomNotFound />
        <div className="fixed top-3 right-3 z-30 island p-1">
          <UserInfo />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-row h-screen justify-center items-center bg-canvas relative touch-none">
        <CanvasBoard roomId={roomId!} role={permission?.role} key={roomId} />
      </div>
      <div className="fixed top-3 right-3 z-30 island flex items-center gap-1 p-1">
        <Presence />
        <IconButton icon="help" label="Take the tour" tooltip="bottom" onClick={() => setRun(true)} />
        {permission?.role != "viewer" && <>
          <ShareCanvas roomId={roomId!} />
          <UserInfo />
        </>}
      </div>
      {permission?.role != "viewer" && <>
        <HistoryButtons/>
        <Toolbar />
        <ToolOptions roomId={roomId!} />
        <SelectionBar />
      </>
      }
      <CanvasList roomId={roomId!} />
      <Joyride
        steps={steps}
        run={run}
        continuous
        showSkipButton={true}
        showProgress
        callback={handleJoyrideCallback}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: "#155dfc",
            backgroundColor: "#171717",
            textColor: "#ffffff",
            arrowColor: "#171717",
            width: "350px"
          },
          tooltipContent: {
            padding: "5px"
          },
          tooltipContainer: {
            padding: "5px",
            fontSize: "14px",
          },
          tooltip: {
            boxSizing: "border-box",
          },
          buttonNext: {
            fontSize: "14px",
            padding: "6px",
            minWidth: "auto",
          },
          buttonBack: {
            fontSize: "14px",
            padding: "6px",
            minWidth: "auto",
          },
        }}
      />
    </>
  );
}

export default CanvasPage;