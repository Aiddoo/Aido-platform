import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useLocaleContext } from '@src/shared/hooks/use-locale-context';
import { useStoredValue } from '@src/shared/storage/use-stored-value';

import { recognitionLanguageStoredValue } from '../schemas/recognition-language-storage.schema';

/** 계정이 고른 인식 언어. 고른 적 없으면 앱 언어를 따르고, 계정을 모르면 저장하지 않는다 */
export function useRecognitionLanguage() {
  const { speechLocale } = useLocaleContext();
  const accountId = useMyAccountId();
  const [savedLocale, setLocale] = useStoredValue(recognitionLanguageStoredValue, accountId);

  return [savedLocale ?? speechLocale, setLocale] as const;
}
