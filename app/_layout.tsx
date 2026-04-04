import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, LogBox, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { hydrateStorage } from '@/lib/storage';
import { colors } from '@/constants/design';

// Suppress Expo's red-screen overlay for transient Blink SDK / network errors.
// These are caught and handled gracefully in lib/api.ts; the overlay is noise.
LogBox.ignoreLogs([
  'Network request failed',
  'BlinkNetworkError',
  'BlinkDataError',
  'BlinkAuthError',
  'Unexpected response format',
  '<!DOCTYPE',
  'We couldn',
  'couldn\u2019t reach',
]);

// On web: intercept unhandledrejection events BEFORE Expo's useRejectionHandler
// (which registers in a useEffect, i.e. after our module-body code).
// We call stopImmediatePropagation() so Expo's listener never fires, preventing
// the fatal red-screen overlay for transient Blink SDK / network errors.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // Also patch window.addEventListener so that any FUTURE listener registered
  // for 'unhandledrejection' (e.g. Expo's useRejectionHandler useEffect) also
  // has our filter applied — belt-and-suspenders for timing edge cases.
  const _origWinAEL = window.addEventListener.bind(window);
  // Expose the original so lib/blink.ts can bypass the patch if needed
  (window as any).__origAEL = _origWinAEL;
  (window as any).addEventListener = function (
    type: string,
    listener: any,
    options?: any
  ) {
    if (type === 'unhandledrejection' && typeof listener === 'function') {
      const wrapped = function (this: any, ev: PromiseRejectionEvent) {
        if (_isBlinkRejection(ev)) {
          ev.stopImmediatePropagation();
          ev.preventDefault();
          console.warn('[MONSAIK] Filtered rejection in wrapped listener:', String(ev?.reason?.message ?? ev?.reason ?? '').slice(0, 120));
          return;
        }
        return listener.call(this, ev);
      };
      return _origWinAEL(type, wrapped, options);
    }
    return _origWinAEL(type, listener, options);
  };

  function _isBlinkRejection(event: PromiseRejectionEvent): boolean {
    const reason = event?.reason;
    const msg: string = reason?.message ?? String(reason ?? '');
    // Match any error that could originate from the Blink SDK or network layer
    if (
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
      msg.includes('ERR_') ||
      // SyntaxError from parsing HTML as JSON
      (reason instanceof SyntaxError && (
        msg.includes('token') || msg.includes('DOCTYPE') || msg.includes('JSON')
      ))
    ) {
      return true;
    }
    // Also check the stack trace for Blink SDK frames
    const stack: string = reason?.stack ?? '';
    if (stack.includes('blinkdotnew') || stack.includes('blink.new') || stack.includes('BlinkAuth') || stack.includes('HttpClient')) {
      return true;
    }
    return false;
  }

  // Register our own early listener (runs before any listener added via the
  // patched addEventListener above, since we go through _origWinAEL directly).
  _origWinAEL('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (_isBlinkRejection(event)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      console.warn('[MONSAIK] Suppressed unhandled rejection (early):', String(event?.reason?.message ?? event?.reason ?? '').slice(0, 120));
    }
  });
}

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
