import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, LogBox, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { hydrateStorage } from '@/lib/storage';
import { colors } from '@/constants/design';

// ─── LAYER 1: LogBox ignore patterns ─────────────────────────────────────────
// Suppress warn-level Blink/network noise from React Native's own LogBox.
LogBox.ignoreLogs([
  'Network request failed',
  'BlinkNetworkError',
  'BlinkDataError',
  'BlinkAuthError',
  'Unexpected response format',
  '<!DOCTYPE',
  'We couldn',
  'couldn\u2019t reach',
  'Uncaught (in promise',
  'Service temporarily unavailable',
  'PROXY_ERROR',
  'Failed to fetch',
]);

// ─── ALL WEB-ONLY GUARDS ──────────────────────────────────────────────────────
if (Platform.OS === 'web' && typeof window !== 'undefined') {

  // Helper: decide if an unhandled rejection is Blink / network noise
  function _isBlinkRejection(reason: unknown): boolean {
    const msg: string =
      (reason as any)?.message ?? String(reason ?? '');
    const stack: string = (reason as any)?.stack ?? '';
    return (
      msg.includes('<!DOCTYPE') ||
      msg.includes('Network request failed') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Blink') ||
      msg.includes("couldn't reach") ||
      msg.includes('\u2019t reach') ||
      msg.includes('Unexpected response format') ||
      msg.includes('PROXY_ERROR') ||
      msg.includes('Service temporarily unavailable') ||
      msg.includes('NetworkError') ||
      msg.includes('Uncaught (in promise') ||
      msg.includes('ERR_') ||
      (reason instanceof SyntaxError && (
        msg.includes('token') || msg.includes('DOCTYPE') || msg.includes('JSON')
      )) ||
      stack.includes('blinkdotnew') ||
      stack.includes('blink.new') ||
      stack.includes('BlinkAuth') ||
      stack.includes('HttpClient')
    );
  }

  // ── LAYER 2: window.addEventListener patch ──────────────────────────────────
  // Wraps EVERY future 'unhandledrejection' listener (including Expo's
  // useRejectionHandler) with the Blink filter.  Since this runs at module-body
  // time (before any useEffect), it is applied before Expo's listener registers.
  const _origWinAEL = window.addEventListener.bind(window);
  (window as any).__origAEL = _origWinAEL;

  (window as any).addEventListener = function (
    type: string,
    listener: any,
    options?: any
  ) {
    if (type === 'unhandledrejection' && typeof listener === 'function') {
      const wrapped = function (this: any, ev: PromiseRejectionEvent) {
        if (_isBlinkRejection(ev?.reason)) {
          ev.stopImmediatePropagation();
          ev.preventDefault();
          console.warn('[MONSAIK] Filtered rejection (wrapped):', String((ev?.reason as any)?.message ?? ev?.reason ?? '').slice(0, 120));
          return;
        }
        return listener.call(this, ev);
      };
      return _origWinAEL(type, wrapped, options);
    }
    return _origWinAEL(type, listener, options);
  };

  // ── LAYER 3: early direct listener (capture phase) ──────────────────────────
  // Uses _origWinAEL so it bypasses the wrap above and fires FIRST.
  // capture:true means it runs before any bubble-phase listener.
  _origWinAEL(
    'unhandledrejection',
    (ev: PromiseRejectionEvent) => {
      if (_isBlinkRejection(ev?.reason)) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        console.warn('[MONSAIK] Suppressed rejection (early/capture):', String((ev?.reason as any)?.message ?? ev?.reason ?? '').slice(0, 120));
      }
    },
    true   // capture phase — fires before all bubble-phase listeners
  );

  // ── LAYER 4: NativeLogBox.show() patch ──────────────────────────────────────
  // Patches the error-overlay singleton BEFORE the first Blink error fires.
  // If the error-overlay system calls show(), we check the current LogBox state
  // and suppress the overlay for Blink/network errors.
  let _suppressNextOverlay = false;

  // Keep a second unhandledrejection listener that sets the suppress flag
  _origWinAEL('unhandledrejection', (ev: PromiseRejectionEvent) => {
    if (_isBlinkRejection(ev?.reason)) {
      _suppressNextOverlay = true;
      // Auto-reset after 3 s so genuine later errors still show
      setTimeout(() => { _suppressNextOverlay = false; }, 3000);
    }
  }, true);

  try {
    // Require the NativeLogBox singleton — same module instance used internally
    const NativeLogBox = require('@expo/metro-runtime/src/error-overlay/modules/NativeLogBox').default;
    if (NativeLogBox && typeof NativeLogBox.show === 'function') {
      const _origShow = NativeLogBox.show.bind(NativeLogBox);
      NativeLogBox.show = function () {
        if (_suppressNextOverlay) {
          console.warn('[MONSAIK] Suppressed NativeLogBox.show() for Blink error');
          _suppressNextOverlay = false;
          return;
        }
        return _origShow();
      };
    }
  } catch {
    // Module not available — no-op
  }

  // ── LAYER 5: MutationObserver DOM backstop ──────────────────────────────────
  // Final safety net: if the overlay div is somehow added despite layers 2-4,
  // remove it immediately if it was triggered by a recent Blink rejection.
  let _lastBlinkRejectionMs = 0;
  _origWinAEL('unhandledrejection', (ev: PromiseRejectionEvent) => {
    if (_isBlinkRejection(ev?.reason)) {
      _lastBlinkRejectionMs = Date.now();
    }
  }, true);

  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    const _overlayObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of Array.from(m.addedNodes)) {
          const el = n as HTMLElement;
          if (el?.id === 'error-overlay') {
            const age = Date.now() - _lastBlinkRejectionMs;
            if (age < 4000) {
              console.warn('[MONSAIK] Removing error-overlay div (DOM backstop), age:', age, 'ms');
              // Remove on next tick so the React root can unmount cleanly
              setTimeout(() => {
                try {
                  const NativeLogBox = require('@expo/metro-runtime/src/error-overlay/modules/NativeLogBox').default;
                  NativeLogBox?.hide?.();
                } catch {
                  document.getElementById('error-overlay')?.remove();
                }
              }, 0);
            }
          }
        }
      }
    });
    // Start observing once the body is available
    if (document.body) {
      _overlayObserver.observe(document.body, { childList: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        _overlayObserver.observe(document.body, { childList: true });
      });
    }
  }
}

// ─── QUERY CLIENT ────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      throwOnError: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      throwOnError: false,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  useFrameworkReady();
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    hydrateStorage().then(() => setStorageReady(true));
  }, []);

  if (!storageReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="light" />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
