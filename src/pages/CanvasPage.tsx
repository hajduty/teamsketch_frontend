import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CanvasBoard } from "../features/canvas/Canvas";
import { Toolbar } from "../features/canvas/components/Toolbar";
import { ToolOptions } from "../features/canvas/components/ToolOptions";
import { HistoryButtons } from "../features/canvas/components/HistoryButtons";
import { ShareCanvas } from "../features/canvas/components/ShareCanvas";
import { Permissions } from "../types/permission";
import { CanvasList } from "../features/canvas/components/CanvasList";
import { UserInfo } from "../features/canvas/components/UserInfo";
import { useSignalR } from "../features/auth/ProtectedRoute";
import { v4 as uuidv4 } from 'uuid';

import Joyride, { Step, STATUS, CallBackProps } from "react-joyride";
import { useCanvasStore } from "../features/canvas/canvasStore";
import { Button } from "../components/Button";
import Icon from "../components/Icon";
import apiClient from "../lib/apiClient";
import { useAuth } from "../features/auth/AuthProvider";
import { apiRoutes } from "../lib/apiRoutes";

export const CanvasWrapper = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const {user} = useAuth();

  const createNewRoom = async (): Promise<string | undefined> => {
    try {
      const uuid = uuidv4();
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
        }
      }
    };

    ensureRoomExists();
  }, [roomId, location.pathname, navigate, user?.id]);

  if (!roomId) return <></>;

  return <CanvasPage roomId={roomId} />;
};


function CanvasPage({ roomId }: { roomId: string }) {
  const [permission, setPermission] = useState<Permissions>();
  const { connection } = useSignalR();

  const [run, setRun] = useState(false);
  const [steps] = useState<Step[]>([
    {
      target: ".toolbar",
      content: "This is your toolbar, hover over it to access it, or pin it.",
      placement: "top",
      disableBeacon: true
    },
    {
      target: ".pen-tool",
      content: "This is your main tool for drawing on the screen.",
      disableBeacon: true
    },
    {
      target: ".pen-options",
      content: "Here you can change the settings of your selected tool",
      placement: "right",
      disableBeacon: true
    },
    {
      target: ".history-buttons",
      content: "These are your history controls",
      placement: "top",
      disableBeacon: true
    },
    {
      target: ".canvas-list",
      content: "These are the rooms you have access to.",
      placement: "bottom",
    },
    {
      target: ".share-canvas",
      content: "You can share your canvas with other users.",
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
        case 0:
          useCanvasStore.getState().setTool("select");
          useCanvasStore.getState().setToolbarOpen(true);
          break;
        case 1:
          useCanvasStore.getState().setTool("pen");
          break;
        case 2:
          useCanvasStore.getState().setTool("pen");
          useCanvasStore.getState().setToolOptionsOpen(true);
          useCanvasStore.getState().setToolbarOpen(false);
          break;
        case 3:
          useCanvasStore.getState().setToolOptionsOpen(false);
          useCanvasStore.getState().setRoomListOpen(false);
          break;
        case 4:
          break;
        case 5:
          useCanvasStore.getState().setRoomListOpen(true);
          break;
      }
    }
  };

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
    return (
      <>
        <CanvasList roomId={roomId!} />
        <UserInfo />
        <div className="flex h-screen w-screen justify-center items-center bg-neutral-950">
          <h1 className="text-white text-2xl select-none">This room does not exist.</h1>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-row h-screen justify-center items-center bg-neutral-950 relative touch-none">
        <CanvasBoard roomId={roomId!} role={permission?.role} key={roomId} />
      </div>
      <div className="fixed bottom-0 left-0 group hover:z-3 m-2">
        <Button className="rounded-lg " onClick={() => setRun(true)}><Icon iconName="question_mark" fontSize="18px" color="white" /></Button>
      </div>
      {permission?.role != "viewer" && <>
        <HistoryButtons/>
        <Toolbar />
        <ToolOptions roomId={roomId!} />
        <ShareCanvas roomId={roomId!} />
        <UserInfo />
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