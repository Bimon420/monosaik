// Generate seed SQL files for mood data
const fs = require('fs');

const MOOD_COLORS = [
  ['#FFD700', 'Joyful'], ['#40E0D0', 'Calm'], ['#FF4500', 'Energetic'],
  ['#4169E1', 'Sad'], ['#8A2BE2', 'Creative'], ['#FF1493', 'Excited'],
  ['#ADFF2F', 'Fresh'], ['#708090', 'Neutral'], ['#FF8C00', 'Brave'],
  ['#00CED1', 'Peaceful'], ['#8B4513', 'Grounded'], ['#000000', 'Mysterious'],
];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

const rng = seededRandom(42);
const randomChoice = (arr) => arr[Math.floor(rng() * arr.length)];
const randomInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;

const startDate = new Date('2026-01-08');
const allRows = [];
let moodId = 1;

for (let userNum = 1; userNum <= 80; userNum++) {
  const userId = `user_${String(userNum).padStart(2, '0')}`;
  for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
    if (rng() > 0.82) continue;
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const [color, name] = randomChoice(MOOD_COLORS);
    const hour = randomInt(6, 22);
    const minute = randomInt(0, 59);
    const created = new Date(date);
    created.setHours(hour, minute, 0, 0);
    const mid = `mood_${String(moodId).padStart(5, '0')}`;
    moodId++;
    allRows.push(`('${mid}','${userId}','${color}','${name}',NULL,'${created.toISOString()}','${dateStr}')`);
  }
}

// Write batches of 500
const batchSize = 500;
const prefix = "INSERT INTO moods (id,user_id,color,mood_name,note,created_at,date) VALUES ";

fs.mkdirSync('/tmp/seed', { recursive: true });

for (let i = 0; i < allRows.length; i += batchSize) {
  const chunk = allRows.slice(i, i + batchSize);
  const sql = prefix + chunk.join(',') + ';';
  const batchNum = Math.floor(i / batchSize);
  fs.writeFileSync(`/tmp/seed/batch_${batchNum}.sql`, sql);
}

// Friends SQL
const friendRows = [];
for (let i = 1; i <= 80; i++) {
  friendRows.push(`('friend_${i}','current_user','user_${String(i).padStart(2, '0')}','accepted','2026-01-01T00:00:00Z')`);
}
fs.writeFileSync('/tmp/seed/friends.sql', 
  "INSERT INTO friends (id,user_id,friend_id,status,created_at) VALUES " + friendRows.join(',') + ';');

// Global mosaic pixels (heart + random scatter)
const pixelRows = [];
const usedKeys = new Set();

// Heart shape
const heartPixels = [
  [28,20],[29,20],[30,20],[33,20],[34,20],[35,20],
  [27,21],[28,21],[29,21],[30,21],[31,21],[32,21],[33,21],[34,21],[35,21],[36,21],
  [27,22],[28,22],[29,22],[30,22],[31,22],[32,22],[33,22],[34,22],[35,22],[36,22],
  [28,23],[29,23],[30,23],[31,23],[32,23],[33,23],[34,23],[35,23],
  [29,24],[30,24],[31,24],[32,24],[33,24],[34,24],
  [30,25],[31,25],[32,25],[33,25],
  [31,26],[32,26],
];

for (const [x, y] of heartPixels) {
  const key = `${x}_${y}`;
  if (!usedKeys.has(key)) {
    usedKeys.add(key);
    const heartColors = ['#FF1493','#FF4500','#FFD700','#FF8C00'];
    pixelRows.push(`('${key}',${x},${y},'${randomChoice(heartColors)}','user_${String(randomInt(1,80)).padStart(2,'0')}','2026-03-08T12:00:00Z')`);
  }
}

// Random scatter
for (let i = 0; i < 500; i++) {
  const x = randomInt(0, 63);
  const y = randomInt(0, 63);
  const key = `${x}_${y}`;
  if (!usedKeys.has(key)) {
    usedKeys.add(key);
    const [color] = randomChoice(MOOD_COLORS);
    pixelRows.push(`('${key}',${x},${y},'${color}','user_${String(randomInt(1,80)).padStart(2,'0')}','2026-03-08T12:00:00Z')`);
  }
}

fs.writeFileSync('/tmp/seed/pixels.sql',
  "INSERT INTO global_mosaic (id,x,y,color,user_id,updated_at) VALUES " + pixelRows.join(',') + ';');

const numBatches = Math.ceil(allRows.length / batchSize);
console.log(JSON.stringify({
  totalMoods: allRows.length,
  numBatches,
  friends: 80,
  pixels: pixelRows.length,
}));
