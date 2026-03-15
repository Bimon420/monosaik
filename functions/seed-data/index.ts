import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MOOD_COLORS = [
  { color: '#FFD700', name: 'Joyful' },
  { color: '#40E0D0', name: 'Calm' },
  { color: '#FF4500', name: 'Energetic' },
  { color: '#4169E1', name: 'Sad' },
  { color: '#8A2BE2', name: 'Creative' },
  { color: '#FF1493', name: 'Excited' },
  { color: '#ADFF2F', name: 'Fresh' },
  { color: '#708090', name: 'Neutral' },
  { color: '#FF8C00', name: 'Brave' },
  { color: '#00CED1', name: 'Peaceful' },
  { color: '#8B4513', name: 'Grounded' },
  { color: '#000000', name: 'Mysterious' },
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");
    const projectId = Deno.env.get("BLINK_PROJECT_ID");

    if (!secretKey || !projectId) {
      return new Response(JSON.stringify({ error: "Missing env vars" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blink = createClient({ projectId, secretKey });

    // Seed ~128 users
    const usersBatch: any[] = [];
    const firstNames = ['Max', 'Emma', 'Lukas', 'Mia', 'Paul', 'Lara', 'Jonas', 'Anna', 'Leon', 'Leonie', 'Finn', 'Sophie', 'Felix', 'Marie', 'Luca', 'Lena', 'Elias', 'Hanna', 'Ben', 'Emilia'];
    const lastNames = ['Schmidt', 'Müller', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger'];

    for (let i = 1; i <= 128; i++) {
      const firstName = randomChoice(firstNames);
      const lastName = randomChoice(lastNames);
      const displayName = `${firstName} ${lastName}`;
      const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${i}`;
      
      usersBatch.push({
        id: `user_${String(i).padStart(3, '0')}`,
        username,
        displayName,
        avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${username}`,
        pixelBalance: randomInt(100, 1000),
        themeIcon: 'classic',
      });
    }

    // Insert users in chunks
    const batchSize = 50;
    for (let i = 0; i < usersBatch.length; i += batchSize) {
      const chunk = usersBatch.slice(i, i + batchSize);
      await (blink.db as any).users.createMany(chunk);
    }

    // Seed moods for all users for today
    const dateStr = new Date().toISOString().split('T')[0];
    const todayMoodsBatch: any[] = [];
    for (let i = 1; i <= 128; i++) {
      const userId = `user_${String(i).padStart(3, '0')}`;
      const mood = randomChoice(MOOD_COLORS);
      
      todayMoodsBatch.push({
        id: `mood_today_${i}`,
        userId,
        color: mood.color,
        moodName: mood.name,
        date: dateStr,
        createdAt: new Date().toISOString(),
      });
    }
    
    for (let i = 0; i < todayMoodsBatch.length; i += batchSize) {
      const chunk = todayMoodsBatch.slice(i, i + batchSize);
      await (blink.db as any).moods.createMany(chunk);
    }

    // Seed ~60 days of moods for current_user
    const historyBatch: any[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);

    for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + dayOffset);
      const dStr = date.toISOString().split('T')[0];
      const mood = randomChoice(MOOD_COLORS);

      historyBatch.push({
        id: `mood_history_${dayOffset}`,
        userId: 'current_user',
        color: mood.color,
        moodName: mood.name,
        date: dStr,
        createdAt: date.toISOString(),
      });
    }
    await (blink.db as any).moods.createMany(historyBatch);

    // Seed friends (current_user friends with all 128 users)
    const friendBatch: any[] = [];
    for (let i = 1; i <= 128; i++) {
      friendBatch.push({
        id: `friend_${i}`,
        userId: 'current_user',
        friendId: `user_${String(i).padStart(3, '0')}`,
        status: 'accepted',
      });
    }
    await (blink.db as any).friends.createMany(friendBatch);

    // Seed global mosaic with some pixel art (a heart pattern + random scatter)
    const pixelBatch: any[] = [];
    const usedKeys = new Set<string>();

    // Heart shape in center
    const heartPixels = [
      // Row 1
      [28,20],[29,20],[30,20],[33,20],[34,20],[35,20],
      // Row 2
      [27,21],[28,21],[29,21],[30,21],[31,21],[32,21],[33,21],[34,21],[35,21],[36,21],
      // Row 3
      [27,22],[28,22],[29,22],[30,22],[31,22],[32,22],[33,22],[34,22],[35,22],[36,22],
      // Row 4
      [28,23],[29,23],[30,23],[31,23],[32,23],[33,23],[34,23],[35,23],
      // Row 5
      [29,24],[30,24],[31,24],[32,24],[33,24],[34,24],
      // Row 6
      [30,25],[31,25],[32,25],[33,25],
      // Row 7
      [31,26],[32,26],
    ];

    for (const [x, y] of heartPixels) {
      const key = `${x}_${y}`;
      if (!usedKeys.has(key)) {
        usedKeys.add(key);
        pixelBatch.push({
          id: key,
          x,
          y,
          color: randomChoice(['#FF1493', '#FF4500', '#FFD700', '#FF8C00']),
          userId: `user_${String(randomInt(1, 128)).padStart(3, '0')}`,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Random scatter around the canvas
    for (let i = 0; i < 400; i++) {
      const x = randomInt(0, 63);
      const y = randomInt(0, 63);
      const key = `${x}_${y}`;
      if (!usedKeys.has(key)) {
        usedKeys.add(key);
        pixelBatch.push({
          id: key,
          x,
          y,
          color: randomChoice(MOOD_COLORS).color,
          userId: `user_${String(randomInt(1, 128)).padStart(3, '0')}`,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Insert pixels in batches
    for (let i = 0; i < pixelBatch.length; i += batchSize) {
      const chunk = pixelBatch.slice(i, i + batchSize);
      await (blink.db as any).globalMosaic.createMany(chunk);
    }

    return new Response(
      JSON.stringify({
        success: true,
        moods: historyBatch.length + todayMoodsBatch.length,
        friends: friendBatch.length,
        pixels: pixelBatch.length,
        users: usersBatch.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});