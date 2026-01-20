/**
 * SecureStore(Keychain/Keystore) + 메모리 캐싱
 *
 * 앱 시작 시 TokenStore.initialize() 필수
 */

import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'aido_access_token';
const REFRESH_TOKEN_KEY = 'aido_refresh_token';

// 메모리 캐시 (앱 프로세스 종료 시 자동 소멸)
let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;

export const TokenStore = {
  initialize: async (): Promise<void> => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      ]);

      accessTokenCache = accessToken;
      refreshTokenCache = refreshToken;
    } catch (error) {
      console.error('Failed to initialize TokenStore:', error);
      accessTokenCache = null;
      refreshTokenCache = null;
    }
  },

  getAccessToken: async (): Promise<string | null> => {
    if (accessTokenCache !== null) {
      return accessTokenCache;
    }
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      accessTokenCache = token;
      return token;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  },

  setAccessToken: async (token: string): Promise<void> => {
    accessTokenCache = token;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },

  deleteAccessToken: async (): Promise<void> => {
    accessTokenCache = null;
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  },

  getRefreshToken: async (): Promise<string | null> => {
    if (refreshTokenCache !== null) {
      return refreshTokenCache;
    }
    try {
      const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      refreshTokenCache = token;
      return token;
    } catch (error) {
      console.error('Failed to get refresh token:', error);
      return null;
    }
  },

  setRefreshToken: async (token: string): Promise<void> => {
    refreshTokenCache = token;
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  deleteRefreshToken: async (): Promise<void> => {
    refreshTokenCache = null;
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },

  setTokens: async (accessToken: string, refreshToken: string): Promise<void> => {
    accessTokenCache = accessToken;
    refreshTokenCache = refreshToken;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },

  clearTokens: async (): Promise<void> => {
    accessTokenCache = null;
    refreshTokenCache = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },
};
