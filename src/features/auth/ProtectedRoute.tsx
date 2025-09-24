// ProtectedRoute.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthProvider";

type SignalRContextType = {
  connection: signalR.HubConnection | null;
  isConnected: boolean;
};

const SignalRContext = createContext<SignalRContextType>({
  connection: null,
  isConnected: false,
});

export const useSignalR = () => useContext(SignalRContext);

const ProtectedRoute: React.FC = () => {
  const { authenticated, loading, token } = useAuth();
  const location = useLocation();

  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!authenticated || !token) return;

    if (connection) return; // prevent multiple starts in dev/strict mode

    const conn = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7122/api/permissionshub", {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .build();

    setConnection(conn);

    const start = async () => {
      try {
        await conn.start();
        setIsConnected(true);
        console.log("SignalR connected");
      } catch (err) {
        console.error("SignalR connection failed:", err);
        setTimeout(start, 5000);
      }
    };

    start();

    return () => {
      conn.stop();
      setIsConnected(false);
      console.log("SignalR disconnected");
    };
  }, [authenticated, token]);

  if (loading) return <div>Loading...</div>;

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <SignalRContext.Provider value={{ connection, isConnected }}>
      <Outlet />
    </SignalRContext.Provider>
  );
};

export default ProtectedRoute;
