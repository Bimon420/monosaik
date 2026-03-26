# Monsaik

## Overview
A collaborative mood mosaic app built with Expo (React Native) targeting web. Users pick a daily mood color, contribute to a shared 64×64 pixel canvas, earn "Pixel" currency, and play color mini-games. Powered by the Blink SDK for backend/database.

## Tech Stack
- **Framework**: Expo SDK ~54 with Expo Router (file-based routing)
- **UI**: React Native + NativeWind (Tailwind CSS for RN) + custom UI components
- **State**: React Query (@tanstack/react-query) + Zustand
- **Backend**: Blink SDK (`@blinkdotnew/sdk`) — handles auth, database, real-time sync
- **Language**: TypeScript

## Project Structure
- `app/` — Expo Router pages (file-based routing)
  - `(tabs)/` — Main tab screens: index, mosaic, games, social, profile
  - `_layout.tsx` — Root layout with QueryClient + ErrorBoundary
- `components/` — Shared UI components including collaborative mosaic grid, onboarding modal
- `lib/` — Utilities: blink SDK setup, API helpers, theming, i18n, store, **user identity**
- `constants/` — Design tokens, animations, platform helpers
- `hooks/` — Custom hooks
- `assets/` — Images and icons

## Environment Variables
- `EXPO_PUBLIC_BLINK_PROJECT_ID` — Blink project ID
- `EXPO_PUBLIC_BLINK_PUBLISHABLE_KEY` — Blink publishable key

## Running
The "Start application" workflow runs:
```
EXPO_NO_TELEMETRY=1 npx expo start --web --port 5000
```
The app is served on port 5000 via Metro bundler.

## Features
- **Onboarding**: First-time users see a name-entry modal (OnboardingModal.tsx) before accessing the app
- **User Identity**: Each device generates a UUID (localStorage `monsaik_user_id`), stored as the Blink DB user ID — no more shared `current_user`
- **Mood Tracking**: 32 mood colors with German names; pure color circles (no icons)
- **Options Menu**: Gear button on the daily screen opens a bottom sheet with language selector (17 languages) and disco-mode toggle
- **Collaborative Mosaic**: Real-time shared 64×64 pixel canvas
  - Canvas state persisted in `localStorage` (`monsaik_canvas_v1`)
  - Live sync via Blink realtime channel `global-mosaic` — `pixel_update`, `request_canvas`, `canvas_snapshot` messages
  - On mount, requests a canvas snapshot from peers if local storage is empty
  - Pixel balance persisted in both Blink DB (`users.pixelBalance`) and `localStorage` (`monsaik_balance_v1`)
  - SVG has `pointerEvents: 'none'` on web so the Pressable wrapper captures all click events
  - Coordinate extraction falls back from `locationX/Y` to `pageX/Y - containerPos` for web reliability
- **Disco Mode**: Synchronized color cycling at 400ms intervals across all screens
- **Mood Streak**: Tracks consecutive daily mood logging; shows milestone badges (3/7/14 days) and confetti animation
- **7 Mini-Games**: Muster-Match, Farbblitz, Pixel-Jagd, Farbsequenz, Farb-Mix, Stroop-Test, Farb-Gedächtnis (color memory)
- **Social Screen**: 128-slot grid — real users fill slots from DB, empty slots shown as dashed placeholders; current user always at slot 0
- **Profile**: Real streak from DB, editable display name (tap pencil icon), mood dot history strip, data reset

## Important Architecture Notes
- `db.globalMosaic` does NOT exist in the Blink project schema — canvas state uses localStorage instead
- `db.moods` and `db.users` DO exist and are used for mood logging and pixel balance
- `useWindowDimensions()` required for any layout using screen size — `Dimensions.get()` returns 0 on web at module level
- Never use `npm install` directly — it crashes silently; use the package management tooling
- Metro `blockList` in `metro.config.js` ignores `.local/` to prevent crashes from Replit tooling temp files
- User ID flow: `getUserId()` (lib/user.ts) → localStorage UUID → used as Blink DB user.id

## Deployment
Configured as a static export:
- Build: `npx expo export --platform web`
- Output directory: `dist`
