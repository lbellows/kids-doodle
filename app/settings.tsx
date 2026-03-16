import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePin } from '../hooks/usePin';

const PIN_LENGTH = 4;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

type Step = 'verify' | 'new' | 'confirm';

export default function SettingsScreen() {
  const [step, setStep] = useState<Step>('verify');
  const [digits, setDigits] = useState<string[]>([]);
  const [newPin, setNewPin] = useState('');
  const shakeAnim = useState(() => new Animated.Value(0))[0];
  const { verifyPin, savePin } = usePin();
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
      if (step === 'verify') {
        const ok = await verifyPin(pin);
        if (ok) {
          setStep('new');
          setDigits([]);
        } else {
          shake();
          setTimeout(() => setDigits([]), 500);
        }
      } else if (step === 'new') {
        setNewPin(pin);
        setStep('confirm');
        setDigits([]);
      } else if (step === 'confirm') {
        if (pin === newPin) {
          await savePin(pin);
          Alert.alert('✅', 'PIN updated!', [{ text: 'OK', onPress: () => router.back() }]);
        } else {
          shake();
          setTimeout(() => {
            setStep('new');
            setNewPin('');
            setDigits([]);
          }, 500);
        }
      }
    }
  };

  const titles: Record<Step, string> = {
    verify: 'Enter current PIN',
    new: 'Enter new PIN',
    confirm: 'Confirm new PIN',
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.emoji}>⚙️</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>{titles[step]}</Text>

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
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 24,
    padding: 8,
  },
  backText: {
    fontSize: 18,
    color: '#6C63FF',
    fontWeight: '600',
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
