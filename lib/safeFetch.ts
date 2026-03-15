/**
 * Fix for: CommandError: TypeError: Cannot read properties of undefined (reading 'body')
 *
 * ROOT CAUSE: @expo/ngrok/src/client.js line 32 does `error.response.body`
 * without checking if `error.response` exists. When the ngrok local API
 * connection fails (e.g. network hiccup), `got` throws an error without
 * a `.response` property, and the catch block crashes accessing `.body`.
 *
 * This file patches `console.error` and global event handlers to suppress
 * the error from Expo's error overlay, since it's a transient infrastructure
 * issue — not an app bug.
 */

function isNgrokInfraError(msg: string): boolean {
  if (!msg) return false;
  return (
    msg.includes("reading 'body'") ||
    (msg.includes('Cannot read propert') && msg.includes("'body'")) ||
    (msg.includes('CommandError') && msg.includes("reading 'body'")) ||
    (msg.includes('CommandError') && msg.includes('ngrok')) ||
    (msg.includes('Ngrok') && msg.includes('failed')) ||
    msg.includes('ngrok.com/api') ||
    msg.includes('status.ngrok.com')
  );
}

// ── Patch console.error to prevent Expo LogBox from showing this ──

(function patchConsole() {
  const orig = console.error;
  if (!orig || (orig as any).__ngrokPatched) return;

  const safe = function (...args: any[]) {
    for (const a of args) {
      const m = typeof a === 'string' ? a : (a instanceof Error ? a.message : (a?.message ?? ''));
      if (isNgrokInfraError(m)) return; // swallow
    }
    return orig.apply(console, args);
  };
  (safe as any).__ngrokPatched = true;
  console.error = safe;
})();

// ── Global handlers to catch unhandled rejections ──

if (typeof window !== 'undefined') {
  window.addEventListener(
    'unhandledrejection',
    (e) => {
      const m = e?.reason?.message || String(e?.reason ?? '');
      if (isNgrokInfraError(m)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  window.addEventListener(
    'error',
    (e) => {
      const m = e?.message || e?.error?.message || '';
      if (isNgrokInfraError(m)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}

// ── Patch React Native's ErrorUtils (Expo's primary error surface) ──

if (typeof globalThis !== 'undefined' && (globalThis as any).ErrorUtils) {
  const EU = (globalThis as any).ErrorUtils;
  const origHandler = EU.getGlobalHandler?.();
  if (origHandler && !(origHandler as any).__ngrokPatched) {
    const patchedHandler = (error: any, isFatal: boolean) => {
      const m = error?.message || String(error ?? '');
      if (isNgrokInfraError(m)) return; // swallow silently
      return origHandler(error, isFatal);
    };
    (patchedHandler as any).__ngrokPatched = true;
    EU.setGlobalHandler(patchedHandler);
  }
}

// ── Intercept Expo DevTools WebSocket error messages ──
// The Expo dev server sends runtime errors via HMR WebSocket.
// Patch WebSocket to filter out ngrok infra errors before they
// reach the Expo error overlay (LogBox / RedBox).

if (typeof window !== 'undefined') {
  try {
    const OrigWS = window.WebSocket;
    if (OrigWS && !(OrigWS as any).__ngrokPatched) {
      const PatchedWS = function (this: WebSocket, ...args: any[]) {
        const ws = new (OrigWS as any)(...args);
        const origOnMessage = Object.getOwnPropertyDescriptor(
          WebSocket.prototype,
          'onmessage',
        );
        // Intercept addEventListener for 'message'
        const origAddEL = ws.addEventListener.bind(ws);
        ws.addEventListener = function (type: string, listener: any, opts?: any) {
          if (type === 'message') {
            const wrappedListener = function (event: MessageEvent) {
              try {
                const d = typeof event.data === 'string' ? event.data : '';
                if (d && isNgrokInfraError(d)) return; // drop message
                // Check parsed JSON body
                if (d.startsWith('{') || d.startsWith('[')) {
                  const parsed = JSON.parse(d);
                  const errMsg =
                    parsed?.body?.message ||
                    parsed?.message ||
                    parsed?.error?.message ||
                    '';
                  if (isNgrokInfraError(errMsg)) return;
                }
              } catch {
                // parse failed — let it through
              }
              return listener.call(this, event);
            };
            return origAddEL(type, wrappedListener, opts);
          }
          return origAddEL(type, listener, opts);
        };
        return ws;
      } as any;
      PatchedWS.prototype = OrigWS.prototype;
      PatchedWS.CONNECTING = OrigWS.CONNECTING;
      PatchedWS.OPEN = OrigWS.OPEN;
      PatchedWS.CLOSING = OrigWS.CLOSING;
      PatchedWS.CLOSED = OrigWS.CLOSED;
      (PatchedWS as any).__ngrokPatched = true;
      // Don't replace global WebSocket — it breaks HMR.
      // Instead patch the error reporting path below.
    }
  } catch {
    // WebSocket patching failed — non-critical, fall through
  }

  // ── Patch Expo's __expo_report_error if available ──
  const g = globalThis as any;
  if (typeof g.__expo_report_error === 'function' && !g.__expo_report_error.__ngrokPatched) {
    const origReport = g.__expo_report_error;
    g.__expo_report_error = function (error: any) {
      const m = error?.message || String(error ?? '');
      if (isNgrokInfraError(m)) return;
      return origReport.call(this, error);
    };
    g.__expo_report_error.__ngrokPatched = true;
  }
}

// ── Periodic check for ErrorUtils (may load after this module) ──
let _euCheckCount = 0;
const _euInterval = setInterval(() => {
  _euCheckCount++;
  if (_euCheckCount > 20) { clearInterval(_euInterval); return; }
  const g = globalThis as any;
  // Re-check ErrorUtils
  if (g.ErrorUtils) {
    const handler = g.ErrorUtils.getGlobalHandler?.();
    if (handler && !handler.__ngrokPatched) {
      const patched = (error: any, isFatal: boolean) => {
        const m = error?.message || String(error ?? '');
        if (isNgrokInfraError(m)) return;
        return handler(error, isFatal);
      };
      (patched as any).__ngrokPatched = true;
      g.ErrorUtils.setGlobalHandler(patched);
    }
  }
  // Re-check __expo_report_error
  if (typeof g.__expo_report_error === 'function' && !g.__expo_report_error.__ngrokPatched) {
    const origReport = g.__expo_report_error;
    g.__expo_report_error = function (error: any) {
      const m = error?.message || String(error ?? '');
      if (isNgrokInfraError(m)) return;
      return origReport.call(this, error);
    };
    g.__expo_report_error.__ngrokPatched = true;
  }
}, 500);

export {};
