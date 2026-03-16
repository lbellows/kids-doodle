import { useState, useCallback } from 'react';

export function useLockState() {
  const [locked, setLocked] = useState(false);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(() => setLocked(false), []);

  return { locked, lock, unlock };
}
