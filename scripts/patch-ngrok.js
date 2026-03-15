/**
 * Permanently disables ngrok tunnel to prevent:
 *   CommandError: TypeError: Cannot read properties of undefined (reading 'body')
 *
 * The Blink sandbox serves web preview via sites.blink.new — no tunnel needed.
 */
const fs = require('fs');
const path = require('path');
const nm = path.join(__dirname, '..', 'node_modules');

// ── 1. Neutralize AsyncNgrok.startAsync so it never attempts connection ──
const asyncPath = path.join(nm, '@expo', 'cli', 'build', 'src', 'start', 'server', 'AsyncNgrok.js');
if (fs.existsSync(asyncPath)) {
  let src = fs.readFileSync(asyncPath, 'utf8');
  if (src.includes('ngrok-disabled-v5')) {
    console.log('[patch] AsyncNgrok.js already disabled.');
  } else {
    // Replace startAsync body to be a no-op
    if (src.includes('async startAsync')) {
      src = src.replace(
        /async startAsync\([^)]*\)\s*\{/,
        'async startAsync() { /* ngrok-disabled-v5 */ this.serverUrl = null; return;'
      );
    }
    // Also make _connectToNgrokAsync immediately return null
    if (src.includes('async _connectToNgrokAsync')) {
      src = src.replace(
        /async _connectToNgrokAsync\([^)]*\)\s*\{/,
        'async _connectToNgrokAsync() { return null; /* ngrok-disabled-v5 */'
      );
    }
    // Guard any error.response.body or error.body access
    src = src.replace(/error\.response\.body/g, '(error?.response?.body || {})');
    src = src.replace(/error\.body\.error_code/g, '(error?.body?.error_code)');
    fs.writeFileSync(asyncPath, src);
    console.log('[patch] AsyncNgrok.js disabled — startAsync is now a no-op.');
  }
} else {
  console.log('[patch] AsyncNgrok.js not found, skip.');
}

// ── 2. Neutralize @expo/ngrok module ──
const ngrokIndex = path.join(nm, '@expo', 'ngrok', 'index.js');
if (fs.existsSync(ngrokIndex)) {
  const src = fs.readFileSync(ngrokIndex, 'utf8');
  if (src.includes('ngrok-disabled-v5')) {
    console.log('[patch] @expo/ngrok already disabled.');
  } else {
    fs.writeFileSync(ngrokIndex, `/* ngrok-disabled-v5 */
class NgrokClientError extends Error {
  constructor(m,r,b){super(m||"disabled");this.name="NgrokClientError";this.response=r||null;this.body=b||{msg:"disabled"};}
}
module.exports={connect:async()=>null,disconnect:async()=>{},authtoken:async()=>{},kill:async()=>{},getUrl:()=>null,getApi:()=>null,getVersion:async()=>"4.1.0-noop",getActiveProcess:()=>null,NgrokClientError};
`);
    console.log('[patch] @expo/ngrok neutralized.');
  }
} else {
  console.log('[patch] @expo/ngrok not found, skip.');
}

// ── 3. Patch @expo/ngrok/src/client.js if it exists ──
const clientPath = path.join(nm, '@expo', 'ngrok', 'src', 'client.js');
if (fs.existsSync(clientPath)) {
  let src = fs.readFileSync(clientPath, 'utf8');
  if (!src.includes('ngrok-disabled-v5')) {
    src = src.replace(/error\.response\.body/g, '(error?.response?.body || {})');
    src = src.replace(/err\.body/g, '(err?.body)');
    src = `/* ngrok-disabled-v5 patched */\n${src}`;
    fs.writeFileSync(clientPath, src);
    console.log('[patch] @expo/ngrok/src/client.js patched.');
  }
} else {
  console.log('[patch] client.js not found, skip.');
}

// ── 4. Patch @expo/ngrok/src/utils.js if it exists ──
const utilsPath = path.join(nm, '@expo', 'ngrok', 'src', 'utils.js');
if (fs.existsSync(utilsPath)) {
  let src = fs.readFileSync(utilsPath, 'utf8');
  if (!src.includes('ngrok-disabled-v5')) {
    src = src.replace(/err\.body/g, '(err?.body)');
    src = `/* ngrok-disabled-v5 patched */\n${src}`;
    fs.writeFileSync(utilsPath, src);
    console.log('[patch] @expo/ngrok/src/utils.js patched.');
  }
} else {
  console.log('[patch] utils.js not found, skip.');
}

console.log('[patch] Done — ngrok is fully neutralized.');
