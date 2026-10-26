import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

export type LegalDocument = 'terms' | 'privacy';

/** 랜딩(aido.kr)이 게시하는 약관·개인정보 처리방침의 언어별 주소. www를 붙이면 308 리다이렉트가 생긴다. */
export function legalUrl(document: LegalDocument, language: ResolvedLanguage): string {
  return `https://aido.kr/${language}/${document}`;
}
