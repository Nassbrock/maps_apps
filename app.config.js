module.exports = {
  expo: {
    name: 'Maps App',
    slug: 'maps-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      }
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'webpack',
      config: {
        env: {
          EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
          EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID
        }
      }
    },
    extra: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      googleMapsMapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID
    }
  }
}; 