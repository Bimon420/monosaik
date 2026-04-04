export const MOOD_COLORS = [
  { color: '#FF2020', name: 'Wütend' },
  { color: '#FF8800', name: 'Energetisch' },
  { color: '#FFD600', name: 'Freudig' },
  { color: '#AADD00', name: 'Frisch' },
  { color: '#00BB44', name: 'Hoffnungsvoll' },
  { color: '#00DDCC', name: 'Entspannt' },
  { color: '#00BBFF', name: 'Friedlich' },
  { color: '#2244FF', name: 'Traurig' },
  { color: '#7700CC', name: 'Kreativ' },
  { color: '#CC00CC', name: 'Leidenschaftlich' },
  { color: '#FF1177', name: 'Verliebt' },
  { color: '#FF88BB', name: 'Zärtlich' },
  { color: '#FF6633', name: 'Mutig' },
  { color: '#997744', name: 'Geerdet' },
  { color: '#778899', name: 'Neutral' },
  { color: '#334499', name: 'Geheimnisvoll' },
];

export const THEME_ICONS = [
  { id: 'classic', name: 'Klassisch', price: 0, preview: 'sunny' },
  { id: 'gaming', name: 'Gaming', price: 500, preview: 'game-controller' },
  { id: 'food', name: 'Essen', price: 500, preview: 'pizza' },
  { id: 'nature', name: 'Natur', price: 500, preview: 'leaf' },
  { id: 'retro', name: 'Retro', price: 500, preview: 'videocam' },
  { id: 'minimal', name: 'Minimal', price: 500, preview: 'square' },
];

export const THEME_MOODS: Record<string, { icon: string }[]> = {
  classic: [
    { icon: 'flash' }, { icon: 'sunny' }, { icon: 'star' }, { icon: 'leaf' },
    { icon: 'heart' }, { icon: 'water' }, { icon: 'cloud' }, { icon: 'rainy' },
    { icon: 'moon' }, { icon: 'flower' }, { icon: 'flame' }, { icon: 'color-wand' },
    { icon: 'shield' }, { icon: 'planet' }, { icon: 'remove-circle' }, { icon: 'sparkles' },
  ],
  gaming: [
    { icon: 'skull' }, { icon: 'game-controller' }, { icon: 'trophy' }, { icon: 'rocket' },
    { icon: 'heart' }, { icon: 'speedometer' }, { icon: 'headset' }, { icon: 'disc' },
    { icon: 'diamond' }, { icon: 'flash' }, { icon: 'play' }, { icon: 'medal' },
    { icon: 'shield-half' }, { icon: 'planet' }, { icon: 'remove-circle' }, { icon: 'star' },
  ],
  food: [
    { icon: 'flame' }, { icon: 'pizza' }, { icon: 'ice-cream' }, { icon: 'nutrition' },
    { icon: 'heart' }, { icon: 'cafe' }, { icon: 'beer' }, { icon: 'wine' },
    { icon: 'fast-food' }, { icon: 'leaf' }, { icon: 'sunny' }, { icon: 'sparkles' },
    { icon: 'star' }, { icon: 'flower' }, { icon: 'remove-circle' }, { icon: 'ribbon' },
  ],
  nature: [
    { icon: 'flame' }, { icon: 'sunny' }, { icon: 'leaf' }, { icon: 'flower' },
    { icon: 'heart-outline' }, { icon: 'water' }, { icon: 'cloud' }, { icon: 'rainy' },
    { icon: 'moon' }, { icon: 'rose' }, { icon: 'bonfire' }, { icon: 'earth' },
    { icon: 'shield' }, { icon: 'planet' }, { icon: 'remove-circle' }, { icon: 'sparkles' },
  ],
  retro: [
    { icon: 'flash' }, { icon: 'tv' }, { icon: 'radio' }, { icon: 'musical-notes' },
    { icon: 'heart' }, { icon: 'camera' }, { icon: 'headset' }, { icon: 'film' },
    { icon: 'disc' }, { icon: 'videocam' }, { icon: 'mic' }, { icon: 'aperture' },
    { icon: 'compass' }, { icon: 'flag' }, { icon: 'remove-circle' }, { icon: 'star' },
  ],
  minimal: [
    { icon: 'flash' }, { icon: 'square' }, { icon: 'star' }, { icon: 'add' },
    { icon: 'heart' }, { icon: 'ellipse' }, { icon: 'play' }, { icon: 'arrow-up' },
    { icon: 'diamond' }, { icon: 'triangle' }, { icon: 'refresh' }, { icon: 'grid' },
    { icon: 'checkmark' }, { icon: 'radio-button-on' }, { icon: 'remove' }, { icon: 'options' },
  ],
};
