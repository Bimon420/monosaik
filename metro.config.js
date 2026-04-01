const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return middleware(req, res, next);
    };
  },
};

// Prevent Metro from watching Replit's internal .local directory —
// temp files there appear and vanish, crashing the Metro file watcher.
const localDir = path.resolve(__dirname, '.local');
const localPattern = new RegExp(
  `^${localDir.replace(/[/\\]/g, '[/\\\\]')}[/\\\\]`
);

const existingBlockList = config.resolver?.blockList;
const existingArray = Array.isArray(existingBlockList)
  ? existingBlockList
  : existingBlockList
  ? [existingBlockList]
  : [];

config.resolver = {
  ...config.resolver,
  blockList: [...existingArray, localPattern],
};

// Force Metro to Babel-transform react-native-worklets so that ES2022
// private class fields (#field) are downcompiled to ES2015 class syntax.
// Without this, iOS Safari < 14.5 throws a SyntaxError and shows a red screen.
const packagesToTransform = [
  'react-native-worklets',
  'react-native-reanimated',
];
const transformIgnoreRegex = new RegExp(
  `node_modules/(?!(${packagesToTransform.join('|')})/).*`
);
config.transformer = {
  ...config.transformer,
  transformIgnorePatterns: [transformIgnoreRegex],
};

module.exports = config;
