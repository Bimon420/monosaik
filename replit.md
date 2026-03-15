# Monsaik

## Overview
A collaborative mosaic app built with Expo (React Native) targeting web and mobile. Users can place colored pixels on a shared global mosaic canvas, earn "pixel" currency, play games, and interact socially. Powered by the Blink SDK for backend/database.

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
- `components/` — Shared UI components including collaborative mosaic grid
- `lib/` — Utilities: blink SDK setup, API helpers, theming, i18n, store
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

## Deployment
Configured as a static export:
- Build: `npx expo export --platform web`
- Output directory: `dist`
