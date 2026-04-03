import { createClient, AsyncStorageAdapter } from '@blinkdotnew/sdk'
import { Platform } from 'react-native'

// ─── EARLY ERROR GUARD ────────────────────────────────────────────────────────
// This MUST run before Expo mounts its ErrorOverlay (which registers its own
// window.addEventListener('unhandledrejection') in a useEffect).
// Our handler runs first (registered at module-eval time) and calls
// event.stopImmediatePropagation() so Expo's ExceptionsManager never sees the
// error, preventing the full red-screen fatal overlay for transient Blink SDK
// network failures (e.g. when the Replit proxy returns HTML instead of JSON).
function isBlinkOrHtmlError(msg: string): boolean {
  return (
    msg.includes('<!DOCTYPE') ||
    msg.includes('BlinkNetworkError') ||
    msg.includes('BlinkAuthError') ||
    msg.includes('BlinkDataError') ||
    msg.includes('BlinkValidationError') ||
    msg.includes("couldn't reach") ||
    msg.includes('\u2019t reach') ||   // curly apostrophe version
    msg.includes('Network request failed') ||
    msg.includes('Unexpected response format') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError')
  )
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      const reason = event?.reason
      const msg: string =
        reason?.message ?? (typeof reason === 'string' ? reason : '') ?? ''

      if (isBlinkOrHtmlError(msg)) {
        console.warn('[MONSAIK] Suppressed unhandled rejection:', msg.slice(0, 120))
        // stopImmediatePropagation prevents Expo's useRejectionHandler from
        // calling ExceptionsManager.handleException (which shows the red screen).
        event.stopImmediatePropagation()
        event.preventDefault()
      }
    },
    // false = bubble phase, same phase as Expo's listener.
    // Registered earlier (module eval) → runs first → can stop subsequent listeners.
    false
  )
}

// ─── BLINK CLIENT ─────────────────────────────────────────────────────────────
function createBlinkClient() {
  try {
    const config: any = {
      projectId: process.env.EXPO_PUBLIC_BLINK_PROJECT_ID || 'mood-mosaic-app-dffxk768',
      publishableKey: process.env.EXPO_PUBLIC_BLINK_PUBLISHABLE_KEY || 'blnk_pk_-4fDJNByFGB70Bh7TT5DrdTdesSSj2Fg',
      authRequired: false,
      auth: { mode: 'headless' as const },
    }

    if (Platform.OS !== 'web') {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default
        const WebBrowser = require('expo-web-browser')
        config.storage = new AsyncStorageAdapter(AsyncStorage)
        config.auth.webBrowser = WebBrowser
      } catch (e) {
        console.warn('[MONSAIK] Failed to load native modules:', e)
      }
    }

    const client = createClient(config)

    // Attach a silent .catch() to the SDK's internal auth-init promise so it
    // is never "unhandled" from the polyfilled-Promise rejection tracker either.
    const authAny = client?.auth as any
    if (authAny?.initializationPromise?.catch) {
      authAny.initializationPromise.catch((err: unknown) => {
        console.warn('[MONSAIK] Blink auth init error (suppressed):', err)
      })
    }

    return client
  } catch (e) {
    console.warn('[MONSAIK] Failed to create Blink client:', e)
    return null as any
  }
}

export const blink = createBlinkClient()
