import { create } from 'zustand';

export const LANGUAGES = [
  { id: 'de', name: 'Deutsch' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' },
  { id: 'it', name: 'Italiano' },
  { id: 'pt', name: 'Português' },
  { id: 'nl', name: 'Nederlands' },
  { id: 'ru', name: 'Русский' },
  { id: 'zh', name: '中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'ar', name: 'العربية' },
  { id: 'tr', name: 'Türkçe' },
  { id: 'hi', name: 'हिन्दी' },
  { id: 'vi', name: 'Tiếng Việt' },
  { id: 'pl', name: 'Polski' },
  { id: 'sv', name: 'Svenska' },
];

const TRANSLATIONS: Record<string, Record<string, string>> = {
  de: {
    daily_title: 'Wie fühlst du dich?',
    daily_subtitle: 'Wähle eine Farbe, die deinen Tag definiert.',
    daily_submit: 'Check-in +10 Pixels',
    daily_update: 'Stimmung aktualisieren',
    daily_logged: 'Bereits geloggt',
    daily_success_title: 'Stimmung geloggt!',
    daily_update_title: 'Stimmung aktualisiert!',
    daily_reward: '+10 Pixels verdient',
    daily_no_reward: 'Keine extra Pixels',
    daily_back: 'Zurück zur Auswahl',
    mosaic_personal: 'Dein Mosaik',
    mosaic_global: 'Globales Mosaik',
    mosaic_personal_subtitle: 'Jede Kachel ist ein Stück deiner Reise.',
    mosaic_global_subtitle: 'Male gemeinsam mit 128 Freunden!',
    mosaic_empty: 'Starte dein Mosaik, indem du eine tägliche Stimmung wählst.',
    social_title: 'Freunde-Mosaik',
    social_subtitle: 'Das 128er Gitter deiner Gemeinschaft.',
    profile_title: 'Profil',
    profile_pixels: 'Pixels',
    profile_streak: 'Streak',
    profile_themes: 'Themen Icons freischalten',
    profile_invite: 'Freunde einladen',
    profile_logout: 'Abmelden',
    profile_language: 'Sprache',
    pixels_left: 'Pixels übrig',
    paint_with_friends: 'Tippe, um mit Freunden zu malen!',
    games_title: 'Spiele',
    games_subtitle: 'Verdiene Pixels mit Mini-Spielen.',
    game_pixel_match_title: 'Pixel Match',
    game_pixel_match_desc: 'Ordne die Farben dem Zielmuster zu, um Pixels zu gewinnen!',
    game_pixel_match_start: 'Spiel starten',
    game_pixel_match_win: 'Du hast gewonnen! +25 Pixels',
    game_pixel_match_reset: 'Nochmal spielen',
  },
  en: {
    daily_title: 'How are you feeling?',
    daily_subtitle: 'Pick a color that defines your day.',
    daily_submit: 'Check-in +10 Pixels',
    daily_update: 'Update Mood',
    daily_logged: 'Already Logged',
    daily_success_title: 'Mood Logged!',
    daily_update_title: 'Mood Updated!',
    daily_reward: '+10 Pixels earned',
    daily_no_reward: 'No extra pixels',
    daily_back: 'Back to Choice',
    mosaic_personal: 'Your Mosaic',
    mosaic_global: 'Global Mosaic',
    mosaic_personal_subtitle: 'Each tile is a piece of your journey.',
    mosaic_global_subtitle: 'Paint together with 128 friends!',
    mosaic_empty: 'Start your mosaic by picking a daily mood.',
    social_title: 'The Big 128',
    social_subtitle: 'Real-time collective mood grid.',
    profile_title: 'Profile',
    profile_pixels: 'Pixels',
    profile_streak: 'Streak',
    profile_themes: 'Unlock Themed Icons',
    profile_invite: 'Invite Friends',
    profile_logout: 'Logout',
    profile_language: 'Language',
    pixels_left: 'Pixels left',
    paint_with_friends: 'Tap to paint with friends!',
    games_title: 'Games',
    games_subtitle: 'Earn pixels with mini-games.',
    game_pixel_match_title: 'Pixel Match',
    game_pixel_match_desc: 'Match the colors to the target pattern to win pixels!',
    game_pixel_match_start: 'Start Game',
    game_pixel_match_win: 'You won! +25 Pixels',
    game_pixel_match_reset: 'Play Again',
  },
  // Adding placeholders for others, would need real translations for production
  es: { daily_title: '¿Cómo te sientes?', daily_submit: 'Check-in +10 Píxeles' },
  fr: { daily_title: 'Comment te sens-tu ?', daily_submit: 'Check-in +10 Pixels' },
};

interface I18nState {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

export const useI18n = create<I18nState>((set, get) => ({
  language: 'de',
  setLanguage: (lang) => set({ language: lang }),
  t: (key) => {
    const { language } = get();
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || key;
  },
}));
