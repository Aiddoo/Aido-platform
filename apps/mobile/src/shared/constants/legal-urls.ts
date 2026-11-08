import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

export type LegalDocument = 'terms' | 'privacy';

/** www를 붙이면 308 리다이렉트가 생긴다 */
export function getLegalUrl(document: LegalDocument, language: ResolvedLanguage): string {
  return `https://aido.kr/${language}/${document}`;
}
