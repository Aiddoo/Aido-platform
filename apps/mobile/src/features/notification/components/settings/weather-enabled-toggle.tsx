import { PreferencePolicy } from '@src/features/identity/preference/domains/preference.model';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup, WeatherDuoIcon } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';

export function WeatherEnabledToggle() {
  const { t } = useTranslation(['notification', 'auth']);
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());

  return (
    <SettingsListGroup.Toggle
      icon={<SettingsListGroup.Icon Icon={WeatherDuoIcon} />}
      label={t('settings.weatherLabel')}
      description={
        preference.pushEnabled
          ? t('settings.weatherDescription')
          : t('auth:preference.enablePushFirst')
      }
      isSelected={PreferencePolicy.isWeatherEnabled(preference)}
      onSelectedChange={(enabled) =>
        updateMutation.mutate({
          weatherMorningEnabled: enabled,
          weatherEveningEnabled: enabled,
          trackAs: { setting: 'weatherEnabled', value: enabled },
        })
      }
      isDisabled={!preference.pushEnabled || updateMutation.isPending}
    />
  );
}
