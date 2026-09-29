import { FC, useEffect, useState } from "react";
import { useCanvasStore } from "../canvasStore";
import { Peer, timeAgo } from "../presence";

const MAX_SHOWN = 4;

/** "On the canvas" or "Last active 3 min ago", kept current while the tooltip is showing. */
const useActivity = (peer: Peer) => {
  const peerLastActive = useCanvasStore(state => state.viewControls?.peerLastActive);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const lastActive = peerLastActive?.(peer.clientId);
      setText(peer.hasCursor ? "On the canvas" : lastActive ? `Last active ${timeAgo(lastActive)}` : "Not on the canvas yet");
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [open, peer.clientId, peer.hasCursor, peerLastActive]);

  return { text, show: () => setOpen(true), hide: () => setOpen(false) };
};

const Avatar: FC<{ peer: Peer; onJump: (peer: Peer) => void }> = ({ peer, onJump }) => {
  const activity = useActivity(peer);
  const label = peer.hasCursor ? `Go to ${peer.name}` : peer.canJump ? `Go to what ${peer.name} is looking at` : `${peer.name} (not on the canvas yet)`;
  return (
    <div
      className="relative group/avatar flex"
      onPointerEnter={activity.show}
      onPointerLeave={activity.hide}
      onFocus={activity.show}
      onBlur={activity.hide}
    >
      <button
        type="button"
        aria-label={label}
        disabled={!peer.canJump}
        onClick={() => onJump(peer)}
        className={`flex items-center justify-center size-7 rounded-full ring-2 ring-surface text-xs font-semibold text-white uppercase
          cursor-pointer transition-[transform,opacity] duration-100 hover:-translate-y-0.5 hover:z-10 hover:opacity-100 focus-visible:z-10
          disabled:cursor-default disabled:hover:translate-y-0 ${peer.hasCursor ? "" : "opacity-55"}`}
        style={{ backgroundColor: peer.color }}
      >
        {peer.name[0] ?? "?"}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute z-50 top-full right-0 mt-2 w-max rounded-md bg-raised border border-line px-2.5 py-1.5 text-xs text-ink
          opacity-0 transition-opacity duration-100 group-hover/avatar:opacity-100 group-hover/avatar:delay-300 group-has-[:focus-visible]/avatar:opacity-100"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <span className={`size-1.5 rounded-full ${peer.hasCursor ? "bg-[#30a46c]" : "bg-ink-faint"}`} />
          {peer.name}
        </span>
        <span className="block mt-0.5 text-ink-muted">{activity.text}</span>
        {peer.canJump && (
          <span className="block mt-0.5 text-ink-faint">
            {peer.hasCursor ? "Click to go to their cursor" : "Click to see what they're looking at"}
          </span>
        )}
      </span>
    </div>
  );
};

/** Other people in the room; clicking one moves the view to their cursor, or where it last was. */
export const Presence: FC = () => {
  const peers = useCanvasStore(state => state.peers);
  const jumpToPeer = useCanvasStore(state => state.viewControls?.jumpToPeer);

  if (peers.length === 0) return null;

  const shown = peers.slice(0, MAX_SHOWN);
  const hidden = peers.slice(MAX_SHOWN);
  const onJump = (peer: Peer) => jumpToPeer?.(peer.clientId);

  return (
    <>
      <div className="flex items-center -space-x-1.5 px-1" role="group" aria-label="People in this room">
        {shown.map(peer => <Avatar key={peer.userId} peer={peer} onJump={onJump} />)}
        {hidden.length > 0 && (
          <span
            title={hidden.map(p => p.name).join(", ")}
            className="flex items-center justify-center size-7 rounded-full ring-2 ring-surface bg-raised text-[11px] font-semibold text-ink-muted tabular"
          >
            +{hidden.length}
          </span>
        )}
      </div>
      <div className="w-px h-5 bg-line mx-0.5" />
    </>
  );
};
