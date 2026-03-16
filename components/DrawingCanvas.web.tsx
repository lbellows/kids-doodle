/**
 * Web-only DrawingCanvas — uses HTML5 <canvas> so Skia / CanvasKit
 * is never imported on the web bundle.
 * Metro resolves this file instead of DrawingCanvas.tsx when bundling for web.
 */
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

export interface DrawingCanvasRef {
  clear: () => void;
}

interface Props {
  color: string;
  strokeWidth: number;
  eraser: boolean;
  locked: boolean;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, Props>(
  ({ color, strokeWidth, eraser, locked }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasRef = useRef<any>(null);
    const drawing = useRef(false);

    useImperativeHandle(ref, () => ({
      clear() {
        const el = canvasRef.current as HTMLCanvasElement | null;
        if (!el) return;
        el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
      },
    }));

    // Keep canvas pixel dimensions in sync with its CSS dimensions
    useEffect(() => {
      const el = canvasRef.current as HTMLCanvasElement | null;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        el.width = el.offsetWidth;
        el.height = el.offsetHeight;
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

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
        ctx.beginPath();
        ctx.moveTo(x, y);
      };

      const onMove = (e: MouseEvent | TouchEvent) => {
        if (!drawing.current || locked) return;
        e.preventDefault();
        const { x, y } = pos(e);
        ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = eraser ? strokeWidth * 3 : strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
      };

      const onEnd = () => { drawing.current = false; };

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
    }, [color, strokeWidth, eraser, locked]);

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
