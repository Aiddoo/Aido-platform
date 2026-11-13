import { getLegalUrl } from '@src/shared/constants/legal-urls';
import { formatDateLabel } from '@src/shared/date/format/date-format';
import { type Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { compact } from 'es-toolkit';
import type { ComponentProps } from 'react';

import { useGetConsentQueryOptions } from '../queries/consent.queries';

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

export function TermsAgreementList(props: SettingsSectionProps) {
  const { t } = useTranslation('settings');
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const openUrl = useOpenInAppBrowser();
  const { resolvedLanguage } = useLanguage();
  const dateFormatContext = useDateFormatContext();

  const getConsentDescription = (agreedAt: Instant | null) =>
    compact([
      agreedAt == null
        ? t('terms.notAgreed')
        : t('terms.agreedAt', {
            date: formatDateLabel(agreedAt, 'monthDayYear', dateFormatContext),
          }),
      consent.agreedTermsVersion && t('terms.version', { version: consent.agreedTermsVersion }),
    ]).join('\n');

  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item
        label={t('terms.termsOfService')}
        description={getConsentDescription(consent.termsAgreedAt)}
        onPress={() => openUrl(getLegalUrl('terms', resolvedLanguage))}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item
        label={t('terms.privacyPolicy')}
        description={getConsentDescription(consent.privacyAgreedAt)}
        onPress={() => openUrl(getLegalUrl('privacy', resolvedLanguage))}
      />
    </SettingsListGroup>
  );
}
