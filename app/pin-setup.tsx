import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePin } from '../hooks/usePin';

const PIN_LENGTH = 4;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function PinSetupScreen() {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [digits, setDigits] = useState<string[]>([]);
  const shakeAnim = useState(() => new Animated.Value(0))[0];
  const { savePin } = usePin();
  const router = useRouter();

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
      if (step === 'enter') {
        setFirstPin(pin);
        setStep('confirm');
        setDigits([]);
      } else {
        if (pin === firstPin) {
          await savePin(pin);
          router.replace('/');
        } else {
          shake();
          setTimeout(() => {
            setStep('enter');
            setFirstPin('');
            setDigits([]);
          }, 600);
        }
      }
    }
  };

  const title = step === 'enter' ? 'Create a PIN' : 'Confirm PIN';
  const subtitle =
    step === 'enter'
      ? 'Parents use this PIN to unlock the app'
      : 'Enter your PIN again';

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔐</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <Animated.View style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.dot, i < digits.length && styles.dotFilled]} />
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
    flex: 1,
    backgroundColor: '#F0EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: '#6C63FF',
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  keyEmpty: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
  },
});
