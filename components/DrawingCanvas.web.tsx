/**
 * Web-only DrawingCanvas — uses HTML5 <canvas> so Skia / CanvasKit
 * is never imported on the web bundle.
 * Metro resolves this file instead of DrawingCanvas.tsx when bundling for web.
 *
 * Strokes are retained as point lists so undo (and resize) can replay them.
 * The in-progress stroke is still drawn incrementally, so live drawing never
 * pays the cost of a full redraw.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react';
import { View, StyleSheet } from 'react-native';

export interface DrawingCanvasRef {
  clear: () => void;
  undo: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  strokeWidth: number;
  eraser: boolean;
}

interface Props {
  color: string;
  strokeWidth: number;
  eraser: boolean;
  locked: boolean;
  /** Called when the undo history becomes empty / non-empty. Must be stable. */
  onHistoryChange?: (canUndo: boolean) => void;
}

function applyStyle(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;
  applyStyle(ctx, stroke);
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  if (stroke.points.length === 1) {
    // A tap with a round cap renders as a dot.
    ctx.lineTo(stroke.points[0].x, stroke.points[0].y);
  } else {
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
  }
  ctx.stroke();
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, Props>(
  ({ color, strokeWidth, eraser, locked, onHistoryChange }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasRef = useRef<any>(null);
    const strokes = useRef<Stroke[]>([]);
    const drawing = useRef(false);
    const [canUndo, setCanUndo] = useState(false);

    const syncHistory = useCallback(() => {
      setCanUndo(strokes.current.length > 0);
    }, []);

    useEffect(() => {
      onHistoryChange?.(canUndo);
    }, [canUndo, onHistoryChange]);

    const redraw = useCallback(() => {
      const el = canvasRef.current as HTMLCanvasElement | null;
      if (!el) return;
      const ctx = el.getContext('2d');
      if (!ctx) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, el.width, el.height);
      for (const stroke of strokes.current) drawStroke(ctx, stroke);
    }, []);

    useImperativeHandle(ref, () => ({
      clear() {
        drawing.current = false;
        strokes.current = [];
        redraw();
        syncHistory();
      },
      undo() {
        drawing.current = false;
        strokes.current = strokes.current.slice(0, -1);
        redraw();
        syncHistory();
      },
    }));

    // Keep canvas pixel dimensions in sync with its CSS dimensions.
    // Assigning width/height wipes the bitmap, so replay the strokes after.
    useEffect(() => {
      const el = canvasRef.current as HTMLCanvasElement | null;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        el.width = el.offsetWidth;
        el.height = el.offsetHeight;
        redraw();
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [redraw]);

    useEffect(() => {
      const el = canvasRef.current as HTMLCanvasElement | null;
      if (!el) return;
      const ctx = el.getContext('2d')!;

      const pos = (e: MouseEvent | TouchEvent) => {
        const r = el.getBoundingClientRect();
        const src = 'touches' in e ? e.touches[0] : e;
        return { x: src.clientX - r.left, y: src.clientY - r.top };
      };

      const onStart = (e: MouseEvent | TouchEvent) => {
        if (locked) return;
        drawing.current = true;
        const { x, y } = pos(e);
        strokes.current = [
          ...strokes.current,
          { points: [{ x, y }], color, strokeWidth: eraser ? strokeWidth * 3 : strokeWidth, eraser },
        ];
        syncHistory();
        ctx.beginPath();
        ctx.moveTo(x, y);
      };

      const onMove = (e: MouseEvent | TouchEvent) => {
        if (!drawing.current || locked) return;
        e.preventDefault();
        const { x, y } = pos(e);
        const stroke = strokes.current[strokes.current.length - 1];
        if (!stroke) return;
        stroke.points.push({ x, y });
        applyStyle(ctx, stroke);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
      };

      const onEnd = () => {
        if (!drawing.current) return;
        drawing.current = false;
        // A tap that never moved is a single point — render it as a dot.
        const stroke = strokes.current[strokes.current.length - 1];
        if (stroke && stroke.points.length === 1) drawStroke(ctx, stroke);
      };

      el.addEventListener('mousedown', onStart);
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseup', onEnd);
      el.addEventListener('mouseleave', onEnd);
      el.addEventListener('touchstart', onStart, { passive: false });
      el.addEventListener('touchmove', onMove, { passive: false });
      el.addEventListener('touchend', onEnd);

      return () => {
        el.removeEventListener('mousedown', onStart);
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseup', onEnd);
        el.removeEventListener('mouseleave', onEnd);
        el.removeEventListener('touchstart', onStart);
        el.removeEventListener('touchmove', onMove);
        el.removeEventListener('touchend', onEnd);
      };
    }, [color, strokeWidth, eraser, locked, syncHistory]);

    return (
      <View style={styles.container}>
        {/* @ts-ignore – canvas is a DOM element; RN-web passes it through fine */}
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', background: '#fff', touchAction: 'none' }}
        />
      </View>
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
