import { useRecognitionLanguageRepository } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useLanguage } from '@src/shared/providers/language-provider';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

import { APP_LANGUAGE_SPEECH_LOCALE } from '../constants/voice.constants';

/** 말하는 언어. 사용자별로 기억하고, 고른 적이 없으면 앱 언어를 따른다 */
export function useRecognitionLanguage() {
  const repository = useRecognitionLanguageRepository();
  const { resolvedLanguage } = useLanguage();
  const { data: me } = useQuery(useGetMeQueryOptions());
  const userId = me?.id;

  const savedLocale = useSyncExternalStore(repository.subscribe, () =>
    userId == null ? undefined : repository.find(userId),
  );
  const locale = savedLocale ?? APP_LANGUAGE_SPEECH_LOCALE[resolvedLanguage];

  const setLocale = useCallback(
    (nextLocale: SpeechLocale) => {
      if (userId != null) {
        repository.save(userId, nextLocale);
      }
    },
    [repository, userId],
  );

  return [locale, setLocale] as const;
}
