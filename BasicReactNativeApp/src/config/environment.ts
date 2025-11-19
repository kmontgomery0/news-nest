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

  // For physical device testing, replace 'localhost' with your machine's IP
  // Example: 'http://192.168.1.100:8000'
  let apiBaseUrl = 'http://localhost:8000';

  if (isDev) {
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to access host machine
      apiBaseUrl = 'http://10.0.2.2:8000';
    } else if (Platform.OS === 'ios') {
      // iOS simulator can use localhost
      apiBaseUrl = 'http://localhost:8000';
      // For physical iOS device, uncomment and set your IP:
      // apiBaseUrl = 'http://192.168.1.100:8000';
    } else if (Platform.OS === 'web') {
      // Web platform uses localhost
      apiBaseUrl = 'http://localhost:8000';
    }
  } else {
    // Production - set your production API URL here
    apiBaseUrl = 'https://news-nest-7hcx.onrender.com';
  }

  return {
    apiBaseUrl,
    isDevelopment: isDev,
  };
};

export const ENV = getEnvironment();

