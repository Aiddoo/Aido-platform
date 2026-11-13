import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/** 기기 인식 모델 받기를 거절한 언어. 다시 묻지 않는다 */
export const offlineModelDeclinedStoredValue = defineStoredValue({
  key: ({ accountId, locale }: { accountId: string; locale: SpeechLocale }) =>
    `aido_offline_model_declined_v1:${encodeURIComponent(accountId)}:${locale}`,
  area: 'account',
  schema: z.literal('declined'),
  fallback: null,
});
