// Read SQL files and send them to Blink DB via API
const fs = require('fs');
const https = require('https');

const PROJECT_ID = process.env.EXPO_PUBLIC_BLINK_PROJECT_ID || 'mood-mosaic-app-dffxk768';
const SECRET_KEY = process.env.BLINK_SECRET_KEY;

async function runSQL(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    const options = {
      hostname: 'blink-apis.blink.new',
      path: `/api/db/${PROJECT_ID}/sql`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Insert moods from batch files
  for (let i = 0; i < 8; i++) {
    const path = `/tmp/seed/batch_${i}.sql`;
    if (!fs.existsSync(path)) {
      console.log(`Batch ${i} not found, skipping`);
      continue;
    }
    const sql = fs.readFileSync(path, 'utf8');
    console.log(`Inserting batch ${i} (${sql.length} chars)...`);
    const result = await runSQL(sql);
    console.log(`  Batch ${i} result:`, JSON.stringify(result).slice(0, 200));
  }

  // Insert pixels
  const pixelPath = '/tmp/seed/pixels.sql';
  if (fs.existsSync(pixelPath)) {
    const sql = fs.readFileSync(pixelPath, 'utf8');
    console.log(`Inserting pixels (${sql.length} chars)...`);
    const result = await runSQL(sql);
    console.log(`  Pixels result:`, JSON.stringify(result).slice(0, 200));
  }

  console.log('Done!');
}

main().catch(console.error);
