import { createClient, AsyncStorageAdapter } from '@blinkdotnew/sdk'
import { Platform } from 'react-native'

// ─── FETCH INTERCEPTOR ───────────────────────────────────────────────────────
// Must run BEFORE createClient() so that every Blink SDK network request goes
// through this wrapper.  When the Replit reverse-proxy returns its "We couldn't
// reach this app" HTML page instead of JSON, we convert the response to a
// well-formed JSON 503 that the SDK's own try/catch handles gracefully,
// preventing any unhandled promise rejection (and therefore no red-screen overlay).
if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const _originalFetch = window.fetch.bind(window)
  const BLINK_HOSTS = ['core.blink.new', 'blink.new', '/api/analytics', '/api/data', '/api/auth', '/api/db']
  const SAFE_RESPONSE_BODY = JSON.stringify({ error: 'Service temporarily unavailable', code: 'PROXY_ERROR' })

  function looksLikeBlinkRequest(input: RequestInfo | URL): boolean {
    try {
      const url =
        typeof input === 'string' ? input
        : input instanceof URL ? input.href
        : (input as Request).url
      return BLINK_HOSTS.some(h => url.includes(h))
    } catch {
      return false
    }
  }

  function safeJsonResponse(): Response {
    return new Response(SAFE_RESPONSE_BODY, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'content-type': 'application/json' }),
    })
  }

  // @ts-ignore - Intentional override of window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Only intercept Blink SDK requests; leave everything else untouched
    if (!looksLikeBlinkRequest(input)) {
      return _originalFetch(input, init)
    }

    let response: Response
    try {
      response = await _originalFetch(input, init)
    } catch {
      // Network error (fetch itself rejected) → give SDK a clean error JSON
      return safeJsonResponse()
    }

    // If the Replit proxy returned HTML instead of JSON, substitute a proper error
    const ct = response.headers.get('content-type') ?? ''
    if (!ct.includes('application/json') && !ct.includes('text/event-stream')) {
      console.warn('[MONSAIK] Blink request returned non-JSON, substituting 503:', input?.toString?.().slice(0, 80))
      return safeJsonResponse()
    }

    return response
  }
}

// ─── SECONDARY GUARD ─────────────────────────────────────────────────────────
// Belt-and-suspenders: suppress any unhandled rejection from the polyfilled
// Promise tracker via LogBox, and from the native browser unhandledrejection
// event. The fetch interceptor above should make these unreachable, but in case
// any code path is missed, these prevent the red-screen overlay.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      const msg: string = event?.reason?.message ?? String(event?.reason ?? '')
      if (
        msg.includes('<!DOCTYPE') ||
        msg.includes('BlinkNetworkError') ||
        msg.includes('BlinkAuthError') ||
        msg.includes('BlinkDataError') ||
        msg.includes('BlinkValidationError') ||
        msg.includes("couldn't reach") ||
        msg.includes('\u2019t reach') ||
        msg.includes('Network request failed') ||
        msg.includes('Unexpected response format') ||
        msg.includes('Failed to fetch') ||
        msg.includes('PROXY_ERROR')
      ) {
        console.warn('[MONSAIK] Suppressed unhandled rejection:', msg.slice(0, 120))
        event.stopImmediatePropagation()
        event.preventDefault()
      }
    },
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

    // Attach a silent .catch() so the polyfilled-Promise rejection tracker
    // never marks initializationPromise as unhandled
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
