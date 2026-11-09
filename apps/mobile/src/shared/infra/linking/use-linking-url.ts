import { useLinkingURL } from 'expo-linking';

/** 라이브러리 훅이라 이 파일 하나에서만 부른다 */
export function useLinkingUrl(): string | null {
  return useLinkingURL();
}
