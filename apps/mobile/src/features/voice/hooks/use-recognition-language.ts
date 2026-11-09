import { useRecognitionLanguageRepository } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useLanguage } from '@src/shared/providers/language-provider';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

import { APP_LANGUAGE_SPEECH_LOCALE } from '../constants/voice.constants';

export function useRecognitionLanguage() {
  const repository = useRecognitionLanguageRepository();
  const { resolvedLanguage } = useLanguage();
  const { data: me } = useQuery(useGetMeQueryOptions());
  const accountId = me?.id;

  const savedLocale = useSyncExternalStore(repository.subscribe, () =>
    accountId == null ? null : repository.find(accountId),
  );
  const locale = savedLocale ?? APP_LANGUAGE_SPEECH_LOCALE[resolvedLanguage];

  const setLocale = useCallback(
    (nextLocale: SpeechLocale) => {
      if (accountId != null) {
        repository.save(accountId, nextLocale);
      }
    },
    [repository, accountId],
  );

  return [locale, setLocale] as const;
}
