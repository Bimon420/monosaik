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

// On web: swallow unhandled-rejection events whose message looks like an HTML
// error page (the Replit proxy "couldn't reach this app" page).  These come
// from Blink SDK requests that fire-and-forget without an attached .catch().
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg: string =
      event?.reason?.message ?? String(event?.reason ?? '');
    if (
      msg.includes('<!DOCTYPE') ||
      msg.includes('Network request failed') ||
      msg.includes('BlinkNetworkError') ||
      msg.includes('BlinkDataError') ||
      msg.includes('BlinkAuthError') ||
      msg.includes("couldn't reach") ||
      msg.includes('couldn\u2019t reach') ||
      msg.includes('Unexpected response format')
    ) {
      console.warn('[MONSAIK] Suppressed unhandled rejection:', msg.slice(0, 120));
      event.preventDefault();
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
