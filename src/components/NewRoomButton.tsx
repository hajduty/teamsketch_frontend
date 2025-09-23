import { useState } from "react";

interface NewRoomButtonProps {
  createNewRoom: () => Promise<void>;
  cooldownMs?: number;
}

export function NewRoomButton({ createNewRoom, cooldownMs = 800 }: NewRoomButtonProps) {
  const [creating, setCreating] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleClick = async () => {
    setCreating(true);
    try {
      await createNewRoom();
    } finally {
      setCreating(false);
      setCooldown(true);
      setTimeout(() => setCooldown(false), cooldownMs);
    }
  };

  const isBusy = creating || cooldown;

  return (
    <button
      onClick={handleClick}
      disabled={isBusy}
      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 transition duration-75 rounded px-3 py-1 text-sm font-medium disabled:bg-gray-600 disabled:hover:bg-gray-600"
    >
      {isBusy && (
        <svg
          className="h-4 w-4 text-white slow-spin"
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
      {isBusy ? "Creating..." : "New room"}
    </button>
  );
}
