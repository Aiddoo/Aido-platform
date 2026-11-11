import type { DateFormatContext } from '@src/shared/date/format/date-format';
import { useLocaleContext } from '@src/shared/hooks/use-locale-context';
import { useLocalDate } from '@src/shared/providers/local-date-provider';

export function useDateFormatContext(): DateFormatContext {
  const { intlLocale } = useLocaleContext();
  const { currentTimeZone } = useLocalDate();
  return { locale: intlLocale, timeZone: currentTimeZone };
}
