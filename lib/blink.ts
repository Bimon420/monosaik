import { createClient, AsyncStorageAdapter } from '@blinkdotnew/sdk'
import { Platform } from 'react-native'

function createBlinkClient() {
  try {
    const config: any = {
      projectId: process.env.EXPO_PUBLIC_BLINK_PROJECT_ID || 'mood-mosaic-app-dffxk768',
      publishableKey: process.env.EXPO_PUBLIC_BLINK_PUBLISHABLE_KEY || 'blnk_pk_-4fDJNByFGB70Bh7TT5DrdTdesSSj2Fg',
      authRequired: false,
      auth: { mode: 'headless' as const },
    }

    // Only add native-specific config when not on web
    if (Platform.OS !== 'web') {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default
        const WebBrowser = require('expo-web-browser')
        config.storage = new AsyncStorageAdapter(AsyncStorage)
        config.auth.webBrowser = WebBrowser
      } catch (e) {
        console.warn('Failed to load native modules:', e)
      }
    }

    const client = createClient(config)

    // The Blink SDK starts async auth initialisation on the web.  If that
    // promise ever rejects (e.g. when the backend returns an HTML error page
    // instead of JSON), it would become an unhandled rejection and trigger
    // Expo's red-screen overlay.  Attach a silent .catch() to prevent that.
    const authAny = client?.auth as any
    if (authAny?.initializationPromise?.catch) {
      authAny.initializationPromise.catch((err: unknown) => {
        console.warn('[MONSAIK] Blink auth init error (suppressed):', err)
      })
    }

    return client
  } catch (e) {
    console.warn('[MONSAIK] Failed to create Blink client:', e)
    // Return a minimal stub so the app doesn't crash
    return null as any
  }
}

export const blink = createBlinkClient()
