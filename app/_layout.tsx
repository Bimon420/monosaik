import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { hydrateStorage } from '@/lib/storage';
import { colors } from '@/constants/design';

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
