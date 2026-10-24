import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Registers an Android back handler. Handlers added later run first (React Native keeps a LIFO
 * list), so a sheet opened on top of a tool closes before the tool does.
 */
export function useHardwareBack(handler: () => boolean, enabled = true): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => ref.current());
    return () => sub.remove();
  }, [enabled]);
}
