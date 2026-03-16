import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Path, Skia, SkPath } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export interface DrawingCanvasRef {
  clear: () => void;
}

interface Stroke {
  path: SkPath;
  color: string;
  strokeWidth: number;
}

interface Props {
  color: string;
  strokeWidth: number;
  eraser: boolean;
  locked: boolean;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, Props>(
  ({ color, strokeWidth, eraser, locked }, ref) => {
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const currentPath = useRef<SkPath | null>(null);

    useImperativeHandle(ref, () => ({
      clear: () => setStrokes([]),
    }));

    const pan = Gesture.Pan()
      .runOnJS(true)
      .onBegin((e) => {
        if (locked) return;
        const path = Skia.Path.Make();
        path.moveTo(e.x, e.y);
        const stroke: Stroke = {
          path,
          color: eraser ? '#FFFFFF' : color,
          strokeWidth: eraser ? strokeWidth * 3 : strokeWidth,
        };
        currentPath.current = path;
        setStrokes((prev) => [...prev, stroke]);
      })
      .onUpdate((e) => {
        if (locked || !currentPath.current) return;
        currentPath.current.lineTo(e.x, e.y);
        // Trigger re-render by shallow-copying array
        setStrokes((prev) => [...prev]);
      })
      .onEnd(() => {
        currentPath.current = null;
      });

    return (
      <GestureDetector gesture={pan}>
        <Canvas style={styles.canvas} pointerEvents={locked ? 'none' : 'auto'}>
          {strokes.map((stroke, i) => (
            <Path
              key={i}
              path={stroke.path}
              color={stroke.color}
              style="stroke"
              strokeWidth={stroke.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
        </Canvas>
      </GestureDetector>
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
