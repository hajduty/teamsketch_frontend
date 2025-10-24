import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface NewRoomButtonProps {
  createNewRoom: () => Promise<string | undefined>;
  cooldownMs?: number;
  creating: boolean;
}

export function NewRoomButton({ createNewRoom, cooldownMs = 200, creating }: NewRoomButtonProps) {
  const navigate = useNavigate();
  const [created, setCreated] = useState(false);

  const handleClick = async () => {
    const roomId = await createNewRoom();

    if (roomId) {
      setCreated(true);
      setTimeout(() => {
        setCreated(false);
        navigate(`/${roomId}`);
      }, cooldownMs);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={creating}
      className={`${created ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"} w-full select-none cursor-pointer flex items-center justify-center gap-2 transition-colors duration-300 rounded px-3 py-1 text-sm font-medium disabled:bg-gray-600 disabled:hover:bg-gray-600`}
    >
      {creating && (
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
      )}
      {creating
        ? "Creating..."
        : created
          ? "Created!"
          : "New room"}
    </button>
  );
}
