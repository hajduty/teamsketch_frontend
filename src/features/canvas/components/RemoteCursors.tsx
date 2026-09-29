import { FC, useCallback, useEffect, useRef, useState } from "react";
import Konva from "konva";
import type { Awareness } from "y-protocols/awareness";
import { AwarenessState } from "../tools/baseTool";
import { colorFor, displayName } from "../presence";

interface RemoteCursorsProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  awareness: Awareness | null;
}

interface CursorInfo {
  clientId: number;
  name: string;
  color: string;
}

// Fraction of the remaining distance covered each frame; smooths out the throttled updates
const FOLLOW = 0.3;

/**
 * Other users' pointers, drawn as HTML on top of the canvas. Positions are written straight
 * to the DOM each frame, so moving cursors don't re-render React or redraw the canvas.
 */
export const RemoteCursors: FC<RemoteCursorsProps> = ({ stageRef, awareness }) => {
  const [cursors, setCursors] = useState<CursorInfo[]>([]);
  // Latest position from awareness, and where each cursor is currently drawn (canvas coords)
  const targets = useRef(new Map<number, { x: number; y: number }>());
  const shown = useRef(new Map<number, { x: number; y: number }>());
  const elements = useRef(new Map<number, HTMLDivElement>());
  const frame = useRef(0);

  const tick = useCallback(() => {
    frame.current = 0;
    const stage = stageRef.current;
    if (!stage) return;
    const scale = stage.scaleX() || 1;
    const origin = stage.container().getBoundingClientRect();
    let moving = false;

    elements.current.forEach((el, clientId) => {
      const target = targets.current.get(clientId);
      if (!target) return;
      let pos = shown.current.get(clientId);
      if (!pos) {
        pos = { ...target };
        shown.current.set(clientId, pos);
      }
      pos.x += (target.x - pos.x) * FOLLOW;
      pos.y += (target.y - pos.y) * FOLLOW;
      if (Math.abs(target.x - pos.x) * scale < 0.1 && Math.abs(target.y - pos.y) * scale < 0.1) {
        pos.x = target.x;
        pos.y = target.y;
      } else {
        moving = true;
      }
      const x = origin.left + stage.x() + pos.x * scale;
      const y = origin.top + stage.y() + pos.y * scale;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });

    if (moving) frame.current = requestAnimationFrame(tick);
  }, [stageRef]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  // Follow awareness: positions go to the animation, the list of cursors to React
  useEffect(() => {
    if (!awareness) return;
    let lastKey = "";
    const update = () => {
      const next: CursorInfo[] = [];
      const seen = new Set<number>();
      (awareness.getStates() as Map<number, AwarenessState>).forEach((state, clientId) => {
        // Only this tab's own pointer is skipped; the same account in another window still shows
        if (clientId === awareness.clientID || !state?.cursorPosition) return;
        const { x, y } = state.cursorPosition;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        targets.current.set(clientId, { x, y });
        seen.add(clientId);
        next.push({ clientId, name: displayName(state.username), color: state.color ?? colorFor(state.userId) });
      });
      for (const id of [...targets.current.keys()]) {
        if (seen.has(id)) continue;
        targets.current.delete(id);
        shown.current.delete(id); // reappears where it is, instead of gliding across the canvas
      }
      const key = next.map(c => `${c.clientId}:${c.name}:${c.color}`).join("|");
      if (key !== lastKey) {
        lastKey = key;
        setCursors(next);
      }
      schedule();
    };
    update();
    awareness.on("change", update);
    return () => awareness.off("change", update);
  }, [awareness, schedule]);

  // Panning and zooming move every cursor on screen
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.on("xChange.cursors yChange.cursors scaleXChange.cursors dragmove.cursors", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      stage.off(".cursors");
      window.removeEventListener("resize", schedule);
    };
  }, [stageRef, schedule]);

  const setElement = (clientId: number) => (el: HTMLDivElement | null) => {
    if (el) {
      elements.current.set(clientId, el);
      schedule();
    } else {
      elements.current.delete(clientId);
    }
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden" aria-hidden="true">
      {cursors.map(cursor => (
        <div
          key={cursor.clientId}
          ref={setElement(cursor.clientId)}
          className="absolute left-0 top-0 will-change-transform"
          style={{ transform: "translate3d(-100px, -100px, 0)" }}
        >
          <svg width="20" height="22" viewBox="0 0 20 22" className="-ml-[3px] -mt-[2px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
            <path
              d="M3 2 L3 17.5 L7.2 13.6 L10.1 20 L13 18.7 L10.2 12.4 L16 12.2 Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="absolute left-3.5 top-[18px] max-w-40 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 text-white shadow-md shadow-black/40"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
};
