import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  StatusBar,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawingCanvas, DrawingCanvasRef } from '../components/DrawingCanvas';
import { Toolbar, BrushSize, brushSizeToPx } from '../components/Toolbar';
import { PinPad } from '../components/PinPad';
import { usePin } from '../hooks/usePin';
import { useLockState } from '../hooks/useLockState';
import { COLORS } from '../components/ColorPicker';

export default function DrawScreen() {
  const router = useRouter();
  const { hasPin, verifyPin } = usePin();
  const { locked, lock, unlock } = useLockState();
  const canvasRef = useRef<DrawingCanvasRef>(null);

  const [color, setColor] = React.useState(COLORS[0]);
  const [brushSize, setBrushSize] = React.useState<BrushSize>('medium');
  const [eraser, setEraser] = React.useState(false);

  // Redirect to PIN setup if no PIN configured
  useEffect(() => {
    if (hasPin === false) {
      router.replace('/pin-setup');
    }
  }, [hasPin, router]);

  // Hide nav bar and prevent back while locked
  useEffect(() => {
    if (locked) {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('inset-swipe');
    } else {
      NavigationBar.setVisibilityAsync('visible');
    }
  }, [locked]);

  // Block hardware back button when locked
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (locked) return true; // consumed, block
      return false;
    });
    return () => sub.remove();
  }, [locked]);

  if (hasPin === null) return null; // loading

  return (
    <View style={styles.container}>
      <StatusBar hidden={locked} />

      {/* Drawing canvas fills the screen */}
      <DrawingCanvas
        ref={canvasRef}
        color={color}
        strokeWidth={brushSizeToPx(brushSize)}
        eraser={eraser}
        locked={locked}
      />

      {/* Toolbar — hidden when locked */}
      {!locked && (
        <SafeAreaView edges={['bottom']} style={styles.toolbarWrapper}>
          <Toolbar
            color={color}
            brushSize={brushSize}
            eraser={eraser}
            onColorChange={setColor}
            onBrushSizeChange={setBrushSize}
            onEraserToggle={() => setEraser((e) => !e)}
            onClear={() => canvasRef.current?.clear()}
          />
        </SafeAreaView>
      )}

      {/* Lock button — top right, hidden when locked */}
      {!locked && (
        <View style={styles.topRight} pointerEvents="box-none">
          <SafeAreaView edges={['top', 'right']} pointerEvents="box-none">
            <TouchableOpacity style={styles.lockBtn} onPress={lock} activeOpacity={0.8}>
              <Text style={styles.lockIcon}>🔒</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.lockBtn, styles.settingsBtn]}
              onPress={() => router.push('/settings')}
              activeOpacity={0.8}
            >
              <Text style={styles.lockIcon}>⚙️</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      )}

      {/* Lock overlay */}
      {locked && (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.overlayInner} pointerEvents="box-none">
            <PinPad
              title="🔒 Enter PIN to unlock"
              verifyPin={verifyPin}
              onSuccess={unlock}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toolbarWrapper: {
    backgroundColor: 'transparent',
  },
  topRight: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  lockBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  settingsBtn: {
    marginTop: 0,
  },
  lockIcon: {
    fontSize: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayInner: {
    padding: 16,
  },
});
