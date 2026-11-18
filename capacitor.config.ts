import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vantrexchemicals.attendance',
  appName: 'Vantrex Attendance',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    Geolocation: {
      permissions: ['location', 'coarseLocation'],
    },
  },
};

export default config;
