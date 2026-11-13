import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps, ComponentType } from 'react';

import {
  useUpdateMarketingConsentMutationOptions,
  useUpdateMarketingPushConsentMutationOptions,
} from '../queries/consent.mutations';
import { useGetConsentQueryOptions } from '../queries/consent.queries';

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

interface MarketingConsentSettingsProps extends SettingsSectionProps {
  /** 광고성 앱 푸시 설명 칸. consent는 기기 알림을 모르므로 화면이 채운다 */
  marketingPushDescription?: ComponentType;
}

/** 동의는 기기 알림과 따로 지키는 법적 선택이라 기기 알림이 꺼져 있어도 늘 바꿀 수 있다 */
export function MarketingConsentSettings({
  marketingPushDescription: MarketingPushDescription,
  ...props
}: MarketingConsentSettingsProps) {
  const { t } = useTranslation('notification');
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const marketingMutation = useMutation(useUpdateMarketingConsentMutationOptions());
  const marketingPushMutation = useMutation(useUpdateMarketingPushConsentMutationOptions());

  return (
    <SettingsListGroup {...props}>
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
        description={
          MarketingPushDescription == null ? (
            t('settings.marketingPushDescription')
          ) : (
            <MarketingPushDescription />
          )
        }
        isSelected={consent.marketingPushAgreedAt != null}
        onSelectedChange={(agreed) => marketingPushMutation.mutate({ agreed, source: 'settings' })}
        isDisabled={marketingPushMutation.isPending}
      />
    </SettingsListGroup>
  );
}

MarketingConsentSettings.Loading = function Loading(props: SettingsSectionProps) {
  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Toggle.Loading hasDescription />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Toggle.Loading hasDescription />
    </SettingsListGroup>
  );
};

MarketingConsentSettings.Error = SettingsListGroup.Error;
