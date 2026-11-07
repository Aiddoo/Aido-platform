import { legalUrl } from '@src/shared/constants/legal-urls';
import { formatDateLabel } from '@src/shared/date/date-format';
import type { Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useGetConsentQueryOptions } from '../queries/consent.queries';

export function TermsAgreementList() {
  const { t } = useTranslation('settings');
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const openUrl = useOpenUrl();
  const { resolvedLanguage } = useLanguage();
  const dateFormatContext = useDateFormatContext();

  const formatAgreedDate = (date: Instant | null) => {
    if (date == null) {
      return t('terms.notAgreed');
    }
    return formatDateLabel(date, 'fullDate', dateFormatContext);
  };

  const getConsentDescription = (agreedAt: Instant | null) =>
    [
      t('terms.agreedAt', { date: formatAgreedDate(agreedAt) }),
      ...(consent.agreedTermsVersion
        ? [t('terms.version', { version: consent.agreedTermsVersion })]
        : []),
    ].join('\n');

  return (
    <SettingsListGroup>
      <SettingsListGroup.Item
        label={t('terms.termsOfService')}
        description={getConsentDescription(consent.termsAgreedAt)}
        onPress={() => openUrl(legalUrl('terms', resolvedLanguage))}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item
        label={t('terms.privacyPolicy')}
        description={getConsentDescription(consent.privacyAgreedAt)}
        onPress={() => openUrl(legalUrl('privacy', resolvedLanguage))}
      />
    </SettingsListGroup>
  );
}
