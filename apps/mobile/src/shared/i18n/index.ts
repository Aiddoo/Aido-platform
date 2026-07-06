// import 순서와 무관하게 init이 선행되도록 사이드이펙트로 로드한다
import './init';
import i18n from 'i18next';

export { useTranslation } from 'react-i18next';
export { getDeviceLanguage } from './device-language';
export type { Namespace } from './resources';
export { resources } from './resources';
export { i18n };

/**
 * React 컴포넌트 밖(에러 핸들러, 토스트 헬퍼 등)에서 사용하는 번역 함수.
 * 컴포넌트 안에서는 언어 변경 시 리렌더되는 useTranslation을 사용할 것.
 */
export const t = i18n.t.bind(i18n);
