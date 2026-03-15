export const MOOD_COLORS = [
  { color: '#FFD700', name: 'Freudig' },
  { color: '#40E0D0', name: 'Ruhig' },
  { color: '#FF4500', name: 'Energetisch' },
  { color: '#4169E1', name: 'Traurig' },
  { color: '#8A2BE2', name: 'Kreativ' },
  { color: '#FF1493', name: 'Aufgeregt' },
  { color: '#ADFF2F', name: 'Frisch' },
  { color: '#708090', name: 'Neutral' },
  { color: '#FF8C00', name: 'Mutig' },
  { color: '#00CED1', name: 'Friedlich' },
  { color: '#8B4513', name: 'Geerdet' },
  { color: '#000000', name: 'Geheimnisvoll' },
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
    { icon: 'sunny' }, { icon: 'water' }, { icon: 'flash' }, { icon: 'rainy' },
    { icon: 'color-wand' }, { icon: 'heart' }, { icon: 'leaf' }, { icon: 'remove-circle' },
    { icon: 'shield' }, { icon: 'cloud' }, { icon: 'planet' }, { icon: 'moon' }
  ],
  gaming: [
    { icon: 'game-controller' }, { icon: 'trophy' }, { icon: 'skull' }, { icon: 'shield-half' },
    { icon: 'diamond' }, { icon: 'heart' }, { icon: 'star' }, { icon: 'medal' },
    { icon: 'joystick' }, { icon: 'disc' }, { icon: 'play' }, { icon: 'pause' }
  ],
  food: [
    { icon: 'pizza' }, { icon: 'ice-cream' }, { icon: 'cafe' }, { icon: 'beer' },
    { icon: 'wine' }, { icon: 'fast-food' }, { icon: 'nutrition' }, { icon: 'restaurant' },
    { icon: 'egg' }, { icon: 'fish' }, { icon: 'pint' }, { icon: 'flask' }
  ],
  nature: [
    { icon: 'leaf' }, { icon: 'flower' }, { icon: 'bonfire' }, { icon: 'cloud' },
    { icon: 'rainy' }, { icon: 'sunny' }, { icon: 'snow' }, { icon: 'thunderstorm' },
    { icon: 'rose' }, { icon: 'tree' }, { icon: 'water' }, { icon: 'flame' }
  ],
  retro: [
    { icon: 'tv' }, { icon: 'radio' }, { icon: 'camera' }, { icon: 'videocam' },
    { icon: 'recording' }, { icon: 'mic' }, { icon: 'musical-notes' }, { icon: 'headset' },
    { icon: 'calculator' }, { icon: 'watch' }, { icon: 'hourglass' }, { icon: 'magnet' }
  ],
  minimal: [
    { icon: 'square' }, { icon: 'ellipse' }, { icon: 'triangle' }, { icon: 'star' },
    { icon: 'heart' }, { icon: 'close' }, { icon: 'add' }, { icon: 'remove' },
    { icon: 'play' }, { icon: 'pause' }, { icon: 'stop' }, { icon: 'radio-button-on' }
  ]
};
