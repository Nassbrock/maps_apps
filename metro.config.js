const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for mjs files
config.resolver.sourceExts.push('mjs');

// Add support for web platform
config.resolver.platforms = ['ios', 'android', 'web'];

// Add support for react-native-web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName.startsWith('react-native')) {
      const webModuleName = moduleName.replace('react-native', 'react-native-web');
      return {
        filePath: require.resolve(webModuleName),
        type: 'sourceFile',
      };
    }
    if (moduleName === 'react-native-maps') {
      return {
        filePath: require.resolve('@vis.gl/react-google-maps'),
        type: 'sourceFile',
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Add extraNodeModules for web
config.resolver.extraNodeModules = {
  'react-native': 'react-native-web',
  'react-native-maps': '@vis.gl/react-google-maps',
};

// Add assetExts for web
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'web.js',
  'web.jsx',
  'web.ts',
  'web.tsx',
];

module.exports = config; 