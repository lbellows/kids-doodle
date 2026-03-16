import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
} from 'react-native';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
const PIN_LENGTH = 4;

interface Props {
  onSuccess: () => void;
  onFailure?: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  title?: string;
}

export function PinPad({ onSuccess, onFailure, verifyPin, title = 'Enter PIN' }: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = async (d: string) => {
    if (d === '') return;
    if (d === '⌫') {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    const next = [...digits, d];
    setDigits(next);

    if (next.length === PIN_LENGTH) {
      const pin = next.join('');
      const ok = await verifyPin(pin);
      if (ok) {
        setDigits([]);
        onSuccess();
      } else {
        shake();
        setTimeout(() => setDigits([]), 500);
        onFailure?.();
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <Animated.View style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < digits.length && styles.dotFilled]}
          />
        ))}
      </Animated.View>

      <View style={styles.grid}>
        {DIGITS.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.key, d === '' && styles.keyEmpty]}
            onPress={() => handleDigit(d)}
            disabled={d === ''}
            activeOpacity={0.7}
          >
            <Text style={styles.keyText}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    minWidth: 300,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6C63FF',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#6C63FF',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 264,
    gap: 12,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
  },
});
