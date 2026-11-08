import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';

import {
  useUpdateMarketingConsentMutationOptions,
  useUpdateMarketingPushConsentMutationOptions,
} from '../queries/consent.mutations';
import { useGetConsentQueryOptions } from '../queries/consent.queries';

export function MarketingConsentSettings() {
  const { t } = useTranslation('notification');
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const marketingMutation = useMutation(useUpdateMarketingConsentMutationOptions());
  const marketingPushMutation = useMutation(useUpdateMarketingPushConsentMutationOptions());

  return (
    <SettingsListGroup>
      <SettingsListGroup.Toggle
        label={t('settings.marketingLabel')}
        description={t('settings.marketingDescription')}
        isSelected={consent.marketingAgreedAt != null}
        onSelectedChange={(agreed) => marketingMutation.mutate({ agreed })}
        isDisabled={marketingMutation.isPending}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Toggle
        label={t('settings.marketingPushLabel')}
        description={t('settings.marketingPushDescription')}
        isSelected={consent.marketingPushAgreedAt != null}
        onSelectedChange={(agreed) => marketingPushMutation.mutate({ agreed })}
        isDisabled={marketingPushMutation.isPending}
      />
    </SettingsListGroup>
  );
}

MarketingConsentSettings.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <SettingsListGroup.Toggle.Loading hasDescription />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Toggle.Loading hasDescription />
    </SettingsListGroup>
  );
};
