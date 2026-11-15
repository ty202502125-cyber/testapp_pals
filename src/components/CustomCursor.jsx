import { useEffect, useRef } from "react";
import "./CustomCursor.css";

/**
 * CustomCursor — animated dot + trailing ring cursor, Midnight Focus edition.
 *
 * Frontend-only: no API / database changes needed. Drop this file in
 * src/components/CustomCursor.jsx, import its CSS, and render
 * <CustomCursor /> once at the top of your app (see INSTALL.md for the
 * exact lines for Check).
 *
 * Colour: lime #b8f53d, set in CustomCursor.css (--cursor-color, one line).
 *
 * Safeguards (same as the original kit):
 * - Dot/ring stay invisible until the first mouse move (no dot stuck
 *   in the top-left corner on load).
 * - Hides when the mouse leaves the window, shows again on re-entry.
 * - Guarded e.target.closest() (mousemove target is not always an Element).
 * - Skips everything on touch devices and when the user prefers
 *   reduced motion — the normal cursor stays in both cases.
 * - Ring also reacts to mousedown (press) as well as hover.
 */
export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    // Only run on real mouse devices, and respect reduced-motion.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let x = 0;
    let y = 0;
    let ringX = 0;
    let ringY = 0;
    let shown = false;
    let raf;

    const show = () => {
      if (shown) return;
      shown = true;
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    };

    const hide = () => {
      shown = false;
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      show();
      dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      const target = e.target instanceof Element ? e.target : null;
      const hovered = target?.closest(
        "a, button, input, select, textarea, label, [role='button']"
      );
      ring.classList.toggle("cursor-ring--hover", Boolean(hovered));
    };

    const onDown = () => ring.classList.add("cursor-ring--press");
    const onUp = () => ring.classList.remove("cursor-ring--press");

    const animate = () => {
      // Lower = slower trailing. 0.15 is a smooth lag.
      ringX += (x - ringX) * 0.15;
      ringY += (y - ringY) * 0.15;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", hide);
    document.addEventListener("mouseenter", show);
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", hide);
      document.removeEventListener("mouseenter", show);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
