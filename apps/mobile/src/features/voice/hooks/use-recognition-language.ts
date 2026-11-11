import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useLanguage } from '@src/shared/providers/language-provider';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { useQuery } from '@tanstack/react-query';

import { APP_LANGUAGE_SPEECH_LOCALE } from '../constants/voice.constants';
import { recognitionLanguageStoredValue } from '../schemas/recognition-language-storage.schema';

/** 계정이 고른 인식 언어. 고른 적 없으면 앱 언어를 따르고, 계정을 모르면 저장하지 않는다 */
export function useRecognitionLanguage() {
  const { resolvedLanguage } = useLanguage();
  const { data: me } = useQuery(useGetMeQueryOptions());
  const [savedLocale, setLocale] = useStoredValue(recognitionLanguageStoredValue, me?.id);

  return [savedLocale ?? APP_LANGUAGE_SPEECH_LOCALE[resolvedLanguage], setLocale] as const;
}
