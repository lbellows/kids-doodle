import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ColorPicker } from './ColorPicker';

export type BrushSize = 'small' | 'medium' | 'large';
const BRUSH_SIZES: { label: string; value: BrushSize; px: number }[] = [
  { label: 'S', value: 'small', px: 4 },
  { label: 'M', value: 'medium', px: 10 },
  { label: 'L', value: 'large', px: 22 },
];

interface Props {
  color: string;
  brushSize: BrushSize;
  eraser: boolean;
  onColorChange: (c: string) => void;
  onBrushSizeChange: (s: BrushSize) => void;
  onEraserToggle: () => void;
  onClear: () => void;
}

export function Toolbar({
  color,
  brushSize,
  eraser,
  onColorChange,
  onBrushSizeChange,
  onEraserToggle,
  onClear,
}: Props) {
  return (
    <View style={styles.container}>
      <ColorPicker selectedColor={eraser ? '' : color} onSelect={(c) => { onColorChange(c); if (eraser) onEraserToggle(); }} />
      <View style={styles.divider} />
      <View style={styles.brushRow}>
        {BRUSH_SIZES.map((b) => (
          <TouchableOpacity
            key={b.value}
            style={[styles.brushBtn, brushSize === b.value && !eraser && styles.brushBtnActive]}
            onPress={() => { onBrushSizeChange(b.value); if (eraser) onEraserToggle(); }}
            activeOpacity={0.7}
          >
            <View style={[styles.brushCircle, { width: b.px, height: b.px, borderRadius: b.px / 2 }]} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.divider} />
      <TouchableOpacity
        style={[styles.iconBtn, eraser && styles.iconBtnActive]}
        onPress={onEraserToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.icon}>⬜</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={onClear} activeOpacity={0.7}>
        <Text style={styles.icon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );
}

export function brushSizeToPx(size: BrushSize): number {
  return BRUSH_SIZES.find((b) => b.value === size)!.px;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  brushRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  brushBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brushBtnActive: {
    backgroundColor: '#E0D8FF',
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  brushCircle: {
    backgroundColor: '#333',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: '#FFE0E0',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  icon: {
    fontSize: 20,
  },
});
