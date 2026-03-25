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

module.exports = config;
