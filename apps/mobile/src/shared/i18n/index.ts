// import 순서와 무관하게 init이 선행되도록 사이드이펙트로 로드한다
import './init';
import i18n, { type ParseKeys } from 'i18next';

import type { Namespace } from './resources';

export { useTranslation } from 'react-i18next';
export type { Namespace } from './resources';
export { resources } from './resources';
export { i18n };

/**
 * React 컴포넌트 밖(에러 핸들러, 토스트 헬퍼 등)에서 사용하는 번역 함수.
 * 컴포넌트 안에서는 언어 변경 시 리렌더되는 useTranslation을 사용할 것.
 */
export const t = i18n.t.bind(i18n);

/**
 * 런타임에 결정되는 키(에러 코드 등)를 조회한다.
 * 키가 없으면 defaultValue를 반환하며, 타입 검증 대상이 아니다.
 */
export const tDynamic = (namespace: Namespace, key: string, defaultValue = ''): string => {
  if (!isTranslationKey(namespace, key)) {
    return defaultValue;
  }
  return i18n.t(key, { ns: namespace });
};

/** 런타임 키가 해당 네임스페이스(폴백 언어 포함)에 있는지 확인한다. */
const isTranslationKey = <TNamespace extends Namespace>(
  namespace: TNamespace,
  key: string,
): key is ParseKeys<TNamespace> => i18n.exists(key, { ns: namespace });
