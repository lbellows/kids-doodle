import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPin } from '../utils/hash';

const PIN_KEY = 'kidsdoodle_pin_hash';

export function usePin() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PIN_KEY).then((val) => {
      setHasPin(val !== null);
    });
  }, []);

  const savePin = useCallback(async (pin: string) => {
    const hashed = await hashPin(pin);
    await AsyncStorage.setItem(PIN_KEY, hashed);
    setHasPin(true);
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const stored = await AsyncStorage.getItem(PIN_KEY);
    if (!stored) return false;
    const hashed = await hashPin(pin);
    return hashed === stored;
  }, []);

  const clearPin = useCallback(async () => {
    await AsyncStorage.removeItem(PIN_KEY);
    setHasPin(false);
  }, []);

  return { hasPin, savePin, verifyPin, clearPin };
}
