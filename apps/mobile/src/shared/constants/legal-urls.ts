import { LANDING_ORIGIN } from '@src/shared/constants/landing-origin';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

export type LegalDocument = 'terms' | 'privacy';

/** 랜딩 문서가 조항 제목에 다는 고정 앵커. 조항 번호나 제목이 바뀌어도 그대로다 */
export type LegalSection = 'overseas-transfer';

export function getLegalUrl(
  document: LegalDocument,
  language: ResolvedLanguage,
  section?: LegalSection,
): string {
  const url = `${LANDING_ORIGIN}/${language}/${document}`;
  return section == null ? url : `${url}#${section}`;
}
