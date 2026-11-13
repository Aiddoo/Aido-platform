// import 순서와 무관하게 init이 선행되도록 사이드이펙트로 로드한다
import './init';
import i18n, { type ParseKeys } from 'i18next';

import type { Namespace } from './resources';

export { Trans, useTranslation } from 'react-i18next';
export type { Namespace } from './resources';
export { i18n };

export const t = i18n.t.bind(i18n);

/**
 * 런타임에 결정되는 키(에러 코드 등)를 조회한다.
 * 키가 없으면 defaultValue를 반환하며, 타입 검증 대상이 아니다.
 */
export function tDynamic(namespace: Namespace, key: string, defaultValue = ''): string {
  if (!isTranslationKey(namespace, key)) {
    return defaultValue;
  }
  return i18n.t(key, { ns: namespace });
}

function isTranslationKey<TNamespace extends Namespace>(
  namespace: TNamespace,
  key: string,
): key is ParseKeys<TNamespace> {
  return i18n.exists(key, { ns: namespace });
}
