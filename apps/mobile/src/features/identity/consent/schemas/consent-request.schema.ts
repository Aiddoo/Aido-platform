import type { UpdateMarketingConsentInput } from '@aido/api';

/** 동의했는지만 바꾼다. 마케팅·광고성 푸시·AI 데이터 제공이 같은 모양이다 */
export type ConsentAgreement = Pick<UpdateMarketingConsentInput, 'agreed'>;
