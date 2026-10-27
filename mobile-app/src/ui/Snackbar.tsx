import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ui } from './tokens';
import { UiText } from './UiText';

type Action = { label: string; onPress: () => void };
type Ctx = { show: (message: string, action?: Action) => void };
const SnackbarContext = createContext<Ctx>({ show: () => {} });

/**
 * Bottom snackbar for quick confirmations, 96dp above the bottom inset so it clears the nav bar.
 * Auto-hides after 4 s (6 s with an action).
 */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; action?: Action } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((message: string, action?: Action) => {
    if (timer.current) clearTimeout(timer.current);
    setState({ message, action });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setState(null), action ? 6000 : 4000);
  }, []);
  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      {state && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 96 + insets.bottom,
            minHeight: 48,
            borderRadius: 8,
            backgroundColor: ui.snackbar,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 16,
            paddingRight: 8,
            gap: 12,
            elevation: 6,
          }}
        >
          <UiText variant="meta" color="#F4F4F5" style={{ flex: 1 }}>
            {state.message}
          </UiText>
          {state.action && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={state.action.label}
              onPress={() => {
                if (timer.current) clearTimeout(timer.current);
                state.action?.onPress();
                setState(null);
              }}
              android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
              hitSlop={{ top: 4, bottom: 4 }}
              style={{ height: 40, paddingHorizontal: 12, justifyContent: 'center' }}
            >
              <UiText variant="meta" color={ui.snackbarAction} style={{ fontWeight: '600' }}>
                {state.action.label}
              </UiText>
            </Pressable>
          )}
        </View>
      )}
    </SnackbarContext.Provider>
  );
}

/** Returns `show(message, action?)` for the nearest `SnackbarProvider`. */
export function useSnackbar(): Ctx {
  return useContext(SnackbarContext);
}
