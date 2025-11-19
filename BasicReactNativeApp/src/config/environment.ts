import {Platform} from 'react-native';

export interface Environment {
  apiBaseUrl: string;
  isDevelopment: boolean;
}

/**
 * Get the current environment configuration
 * 
 * For physical device testing, set this to your computer's IP address:
 * - Mac/Linux: Run `ifconfig | grep "inet "` to find your IP
 * - Windows: Run `ipconfig` to find your IPv4 address
 * 
 * Example: 'http://192.168.1.100:8000'
 */
const getEnvironment = (): Environment => {
  const isDev = __DEV__;
  const PRODUCTION_API_URL = 'https://news-nest-production.up.railway.app';

  let apiBaseUrl = '';

  if (Platform.OS === 'web') {
    // Web platform
    if (isDev) {
      // Development: use localhost
      apiBaseUrl = 'http://localhost:8000';
    } else {
      // Production: use environment variable (for Vercel) or fallback to Railway
      apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.REACT_APP_API_URL ||
        PRODUCTION_API_URL;
    }
  } else {
    // iOS or Android
    if (isDev) {
      // Development: use localhost or device-specific IP
      if (Platform.OS === 'android') {
        // Android emulator uses 10.0.2.2 to access host machine
        apiBaseUrl = 'http://10.0.2.2:8000';
      } else {
        // iOS simulator can use localhost
        apiBaseUrl = 'http://localhost:8000';
        // For physical iOS device, uncomment and set your IP:
        // apiBaseUrl = 'http://192.168.1.100:8000';
      }
    } else {
      // Production: use hardcoded Railway URL
      apiBaseUrl = PRODUCTION_API_URL;
    }
  }

  return {
    apiBaseUrl,
    isDevelopment: isDev,
  };
};

export const ENV = getEnvironment();

