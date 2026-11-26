// import 순서와 무관하게 init이 선행되도록 사이드이펙트로 로드한다
import './init';
import i18n, { type ParseKeys } from 'i18next';

import type { Namespace } from './resources';

export { Trans, useTranslation } from 'react-i18next';
export type { Namespace } from './resources';
export { i18n };

export const t = i18n.t.bind(i18n);

/** 런타임에 정해지는 키(에러 코드 등)라 타입 검증 대상이 아니고, 키가 없으면 defaultValue다 */
export function tDynamic(
  namespace: Namespace,
  key: string,
  defaultValue = '',
  values?: Record<string, number>,
): string {
  if (!isTranslationKey(namespace, key, values)) {
    return defaultValue;
  }
  return i18n.t(key, { ns: namespace, ...values });
}

function isTranslationKey<TNamespace extends Namespace>(
  namespace: TNamespace,
  key: string,
  values?: Record<string, number>,
): key is ParseKeys<TNamespace> {
  // 복수형만 있는 키(en `_one`·`_other`)는 count를 함께 넘겨야 찾는다
  return i18n.exists(key, { ns: namespace, ...values });
}
