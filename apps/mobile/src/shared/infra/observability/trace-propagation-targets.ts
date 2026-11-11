import { escapeRegExp } from 'es-toolkit';

/** 추적 헤더는 우리 API 출처로만 보낸다. 문자열 대상은 부분 일치라 출처 앞뒤를 고정하고, 빈 배열은 어디에도 보내지 않는다(SDK 기본값은 모든 주소) */
export function toTracePropagationTargets(apiUrl: string): RegExp[] {
  if (!URL.canParse(apiUrl)) {
    return [];
  }
  const { origin } = new URL(apiUrl);
  return [new RegExp(`^${escapeRegExp(origin)}(?:[/?#]|$)`)];
}
