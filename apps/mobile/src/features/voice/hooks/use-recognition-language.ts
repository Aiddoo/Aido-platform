import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useLocaleContext } from '@src/shared/hooks/use-locale-context';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { useQuery } from '@tanstack/react-query';

import { recognitionLanguageStoredValue } from '../schemas/recognition-language-storage.schema';

/** 계정이 고른 인식 언어. 고른 적 없으면 앱 언어를 따르고, 계정을 모르면 저장하지 않는다 */
export function useRecognitionLanguage() {
  const { speechLocale } = useLocaleContext();
  const { data: me } = useQuery(useGetMeQueryOptions());
  const [savedLocale, setLocale] = useStoredValue(recognitionLanguageStoredValue, me?.id);

  return [savedLocale ?? speechLocale, setLocale] as const;
}
