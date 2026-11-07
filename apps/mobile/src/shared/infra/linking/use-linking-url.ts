import { useLinkingURL } from 'expo-linking';

/** 앱을 띄웠거나 마지막으로 들어온 링크. 라이브러리 훅이라 이 파일 하나에서만 부른다 */
export function useLinkingUrl(): string | null {
  return useLinkingURL();
}
