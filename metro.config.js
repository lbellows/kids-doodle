const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'web' so Metro resolves .web.tsx/.web.ts platform-specific files
config.resolver.platforms = [...(config.resolver.platforms ?? []), 'web'];

module.exports = config;
