const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyAddModulePathsToTranspile: ['@vis.gl/react-google-maps']
    }
  }, argv);
  
  // Customize the config before returning it.
  config.plugins = config.plugins || [];
  
  // Add environment variables to DefinePlugin
  config.plugins.push(
    new (require('webpack')).DefinePlugin({
      'process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
      'process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID': JSON.stringify(process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID)
    })
  );

  // Add polyfills
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    vm: require.resolve('vm-browserify')
  };

  return config;
}; 