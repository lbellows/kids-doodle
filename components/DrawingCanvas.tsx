/**
 * Native DrawingCanvas — react-native-svg + RNGH PanGesture.
 *
 * Deliberately not Skia: @shopify/react-native-skia downloads prebuilt Skia
 * static libraries from GitHub Releases at install time, which disqualifies the
 * app from F-Droid (only Debian main, trusted Maven repos, the Android/Flutter
 * SDKs, Hermes, PyPI, Nix, Rust, Go and Node are permitted binary sources).
 * react-native-svg is MIT and builds from Java source, so F-Droid can compile it.
 *
 * Strokes are retained as point lists so undo can replay them. The in-progress
 * stroke is held in its own state slot, so a move only re-renders that one path
 * instead of the whole committed array.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

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
}

interface Props {
  color: string;
  strokeWidth: number;
  eraser: boolean;
  locked: boolean;
  /** Called when the undo history becomes empty / non-empty. Must be stable. */
  onHistoryChange?: (canUndo: boolean) => void;
}

/**
 * Build an SVG path `d` from a point list. A single point is emitted as a
 * zero-length line so a round cap renders it as a dot, matching the web canvas.
 */
function toPathData(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  let d = `M${first.x} ${first.y}`;
  if (rest.length === 0) return `${d}L${first.x} ${first.y}`;
  for (const p of rest) d += `L${p.x} ${p.y}`;
  return d;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, Props>(
  ({ color, strokeWidth, eraser, locked, onHistoryChange }, ref) => {
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [current, setCurrent] = useState<Stroke | null>(null);
    // Mirrors `current` so the commit/undo paths can read the in-progress stroke
    // without doing it from inside a state updater — updaters must stay pure,
    // and StrictMode double-invokes them.
    const currentRef = useRef<Stroke | null>(null);

    const setCurrentStroke = useCallback((stroke: Stroke | null) => {
      currentRef.current = stroke;
      setCurrent(stroke);
    }, []);

    const canUndo = strokes.length > 0 || current !== null;
    useEffect(() => {
      onHistoryChange?.(canUndo);
    }, [canUndo, onHistoryChange]);

    // The gesture callbacks are created once, so they read live prop values
    // through a ref rather than closing over stale ones.
    const props = useRef({ color, strokeWidth, eraser, locked });
    props.current = { color, strokeWidth, eraser, locked };

    useImperativeHandle(ref, () => ({
      clear() {
        setCurrentStroke(null);
        setStrokes([]);
      },
      undo() {
        // An in-progress stroke is the most recent one, so it undoes first.
        if (currentRef.current) {
          setCurrentStroke(null);
          return;
        }
        setStrokes((prev) => prev.slice(0, -1));
      },
    }));

    // Fires from both onEnd and onFinalize; the ref check makes it idempotent.
    const commit = useCallback(() => {
      const stroke = currentRef.current;
      if (!stroke) return;
      setCurrentStroke(null);
      setStrokes((prev) => [...prev, stroke]);
    }, [setCurrentStroke]);

    const pan = Gesture.Pan()
      .runOnJS(true)
      .onBegin((e) => {
        const { color: c, strokeWidth: w, eraser: er, locked: isLocked } = props.current;
        if (isLocked) return;
        setCurrentStroke({
          points: [{ x: e.x, y: e.y }],
          // Eraser paints the canvas background rather than clearing pixels;
          // the canvas is opaque white, so the two are indistinguishable.
          color: er ? '#FFFFFF' : c,
          strokeWidth: er ? w * 3 : w,
        });
      })
      .onUpdate((e) => {
        const stroke = currentRef.current;
        if (props.current.locked || !stroke) return;
        setCurrentStroke({ ...stroke, points: [...stroke.points, { x: e.x, y: e.y }] });
      })
      .onEnd(commit)
      .onFinalize(commit);

    return (
      <GestureDetector gesture={pan}>
        <View style={styles.canvas} pointerEvents={locked ? 'none' : 'auto'}>
          <Svg style={StyleSheet.absoluteFill}>
            {strokes.map((stroke, i) => (
              <Path
                key={i}
                d={toPathData(stroke.points)}
                stroke={stroke.color}
                strokeWidth={stroke.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {current && (
              <Path
                d={toPathData(current.points)}
                stroke={current.color}
                strokeWidth={current.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
          </Svg>
        </View>
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
