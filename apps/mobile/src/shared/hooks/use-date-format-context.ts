import { useLanguage } from '@src/shared/providers/language-provider';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { type DateFormatContext, toDateFormatLocale } from '@src/shared/utils/date-format';

/** 표시 언어는 LanguageProvider, 시간대는 LocalDateProvider 하나에서 읽는다. */
export function useDateFormatContext(): DateFormatContext {
  const { resolvedLanguage } = useLanguage();
  const { currentTimeZone } = useLocalDate();
  return { locale: toDateFormatLocale(resolvedLanguage), timeZone: currentTimeZone };
}
