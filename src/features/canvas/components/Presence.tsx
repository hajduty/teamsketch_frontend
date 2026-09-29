import { FC } from "react";
import { useCanvasStore } from "../canvasStore";
import { Peer } from "../presence";

const MAX_SHOWN = 4;

const Avatar: FC<{ peer: Peer; onJump: (peer: Peer) => void }> = ({ peer, onJump }) => {
  const label = peer.hasCursor ? `Go to ${peer.name}` : `${peer.name} (not on the canvas)`;
  return (
    <div className="relative group/avatar flex">
      <button
        type="button"
        aria-label={label}
        disabled={!peer.hasCursor}
        onClick={() => onJump(peer)}
        className="flex items-center justify-center size-7 rounded-full ring-2 ring-surface text-xs font-semibold text-white uppercase
          cursor-pointer transition-transform duration-100 hover:-translate-y-0.5 hover:z-10 focus-visible:z-10
          disabled:cursor-default disabled:opacity-60 disabled:hover:translate-y-0"
        style={{ backgroundColor: peer.color }}
      >
        {peer.name[0] ?? "?"}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-md bg-raised border border-line px-2 py-1 text-xs text-ink
          opacity-0 transition-opacity duration-100 group-hover/avatar:opacity-100 group-hover/avatar:delay-300 group-has-[:focus-visible]/avatar:opacity-100"
      >
        {peer.name}
        <span className="ml-2 text-ink-faint">{peer.hasCursor ? "Click to go to cursor" : "Not on the canvas"}</span>
      </span>
    </div>
  );
};

/** Other people in the room; clicking one moves the view to their cursor. */
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
