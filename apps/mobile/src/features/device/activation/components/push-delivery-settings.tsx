import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';

import { useUpdatePushEnabledMutationOptions } from '../queries/activation.mutations';

export function PushDeliverySettings() {
  const { t } = useTranslation(['notification', 'auth']);
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const pushEnabledMutation = useMutation(useUpdatePushEnabledMutationOptions());

  return (
    <SettingsListGroup>
      <SettingsListGroup.Toggle
        label={t('settings.pushLabel')}
        description={t('settings.pushDescription')}
        isSelected={preference.pushEnabled}
        onSelectedChange={(enabled) => pushEnabledMutation.mutate({ pushEnabled: enabled })}
        isDisabled={updateMutation.isPending || pushEnabledMutation.isPending}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Toggle
        label={t('settings.nightPushLabel')}
        description={
          preference.pushEnabled
            ? t('settings.nightPushDescription')
            : t('auth:preference.enablePushFirst')
        }
        isSelected={preference.nightPushEnabled}
        onSelectedChange={(enabled) => updateMutation.mutate({ nightPushEnabled: enabled })}
        isDisabled={
          !preference.pushEnabled || updateMutation.isPending || pushEnabledMutation.isPending
        }
      />
    </SettingsListGroup>
  );
}

PushDeliverySettings.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <SettingsListGroup.ToggleSkeleton hasDescription />
      <SettingsListGroup.Separator />
      <SettingsListGroup.ToggleSkeleton hasDescription />
    </SettingsListGroup>
  );
};
