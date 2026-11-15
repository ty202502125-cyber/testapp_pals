import { useEffect, useRef } from "react";
import "./CustomCursor.css";

/**
 * CustomCursor — big single-dot cursor, Midnight Focus edition (v2).
 *
 * Replaces the old dot + trailing ring: the ring lagged behind the
 * pointer and the small dot was easy to miss, so this version is one
 * large dot that follows the pointer exactly, with a white border and
 * dark outline so it reads on dark areas AND on lime buttons.
 *
 * Frontend-only: no API / database changes. Render <CustomCursor />
 * once at the top of the app (src/App.jsx already does).
 *
 * Colour: lime #b8f53d, set in CustomCursor.css (--cursor-color).
 *
 * Safeguards:
 * - Dot stays invisible until the first mouse move (no dot stuck
 *   in the top-left corner on load).
 * - Hides when the mouse leaves the window, shows again on re-entry.
 * - Guarded e.target.closest() (mousemove target is not always an Element).
 * - Skips everything on touch devices and when the user prefers
 *   reduced motion — the normal cursor stays in both cases.
 *   (Under reduced motion the native cursor is NOT hidden either,
 *   so the user is never left with no cursor at all.)
 * - Dot grows over interactive elements and presses in on mousedown.
 */
export default function CustomCursor() {
  const dotRef = useRef(null);

  useEffect(() => {
    // Only run on real mouse devices, and respect reduced-motion.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dot = dotRef.current;
    if (!dot) return;

    let shown = false;

    const show = () => {
      if (shown) return;
      shown = true;
      dot.style.opacity = "1";
    };

    const hide = () => {
      shown = false;
      dot.style.opacity = "0";
    };

    const onMove = (e) => {
      show();
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      const target = e.target instanceof Element ? e.target : null;
      const hovered = target?.closest(
        "a, button, input, select, textarea, label, [role='button']"
      );
      dot.classList.toggle("cursor-dot--hover", Boolean(hovered));
    };

    const onDown = () => dot.classList.add("cursor-dot--press");
    const onUp = () => dot.classList.remove("cursor-dot--press");

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", hide);
    document.addEventListener("mouseenter", show);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", hide);
      document.removeEventListener("mouseenter", show);
    };
  }, []);

  return <div ref={dotRef} className="cursor-dot" aria-hidden="true" />;
}
