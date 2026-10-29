// Zoom and pan maths. All coordinates are relative to the CENTRE of the viewport, which is also
// where the content sits when the view is {scale:1, x:0, y:0}. The content is drawn with
// CSS `transform: translate(x, y) scale(scale)` and `transform-origin: center`.

export interface View { scale: number; x: number; y: number }
export interface Size { w: number; h: number }

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const FIT_VIEW: View = { scale: 1, x: 0, y: 0 };

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** Largest size that fits `content` inside `viewport` without distortion. */
export function fitSize(content: Size, viewport: Size): Size {
  if (content.w <= 0 || content.h <= 0) return { w: 0, h: 0 };
  const k = Math.min(viewport.w / content.w, viewport.h / content.h);
  return { w: content.w * k, h: content.h * k };
}

/** Keep the content from being dragged off-screen; centre it on an axis where it is smaller than the viewport. */
export function clampPan(view: View, viewport: Size, content: Size): View {
  const maxX = Math.max(0, (content.w * view.scale - viewport.w) / 2);
  const maxY = Math.max(0, (content.h * view.scale - viewport.h) / 2);
  // `|| 0` turns -0 into 0
  return { ...view, x: Math.min(maxX, Math.max(-maxX, view.x)) || 0, y: Math.min(maxY, Math.max(-maxY, view.y)) || 0 };
}

/** Change zoom while keeping the point under (cx, cy) visually fixed. */
export function zoomAt(view: View, nextScale: number, cx: number, cy: number): View {
  const s = clampScale(nextScale);
  const k = s / view.scale;
  return { scale: s, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k };
}

/** Convert a point in viewport-centre coordinates to content coordinates in 0..1 (0,0 = top-left of content). */
export function viewToContent(view: View, content: Size, px: number, py: number): { u: number; v: number } {
  return {
    u: (px - view.x) / (content.w * view.scale) + 0.5,
    v: (py - view.y) / (content.h * view.scale) + 0.5
  };
}

/** Double-tap behaviour: zoom in on the tapped point, or go back to fit. */
export function toggleZoom(view: View, cx: number, cy: number, zoomedScale = 2.5): View {
  return view.scale > 1.05 ? FIT_VIEW : zoomAt(view, zoomedScale, cx, cy);
}
