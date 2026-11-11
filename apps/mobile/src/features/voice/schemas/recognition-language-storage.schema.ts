import { defineStoredValue } from '@src/shared/storage/define-stored-value';

import { speechLocaleSchema } from '../domains/voice-note.model';

/** 고른 인식 언어. 없으면 앱 언어를 따른다 */
export const recognitionLanguageStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_recognition_language_v1:${encodeURIComponent(accountId)}`,
  area: 'account',
  schema: speechLocaleSchema,
  fallback: null,
});
