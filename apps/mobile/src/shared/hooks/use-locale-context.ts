import type { SupportedLocale } from '@aido/api/vocabulary';
import { APP_LOCALES, type AppLocale } from '@src/shared/i18n/app-locales';
import { useLanguage } from '@src/shared/providers/language-provider';

export type LocaleContext = AppLocale & { language: SupportedLocale };

/** 앱 언어와 그 언어의 Intl·음성 인식·피커 값. 언어를 바꾸면 다시 렌더링한다 */
export function useLocaleContext(): LocaleContext {
  const { resolvedLanguage } = useLanguage();
  return { language: resolvedLanguage, ...APP_LOCALES[resolvedLanguage] };
}
