import { useEffect, useState } from "react";

// Below this width the canvas chrome switches to the compact (phone) layout.
// Tablets and desktops get the regular layout, whatever the input device.
export const COMPACT_QUERY = "(max-width: 639px)";

export function useIsCompact() {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return compact;
}
