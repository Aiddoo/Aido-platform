import { type DateFormatContext, toDateFormatLocale } from '@src/shared/date/format/date-format';
import { useLanguage } from '@src/shared/providers/language-provider';
import { useLocalDate } from '@src/shared/providers/local-date-provider';

export function useDateFormatContext(): DateFormatContext {
  const { resolvedLanguage } = useLanguage();
  const { currentTimeZone } = useLocalDate();
  return { locale: toDateFormatLocale(resolvedLanguage), timeZone: currentTimeZone };
}
