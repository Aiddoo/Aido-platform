import { isWeatherEnabled, PreferencePolicy } from '@src/features/auth/models/auth.model';
import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/use-update-preference-mutation-options';
import {
  GroupSkeleton,
  SettingsCard,
  SettingsTimePicker,
  SettingsToggle,
} from '@src/features/notification/presentations/components/settings';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Spacing, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function WeatherSettingsScreen() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />
        <QueryErrorBoundary>
          <Suspense fallback={<WeatherSettingsForm.Loading />}>
            <WeatherSettingsForm />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

function WeatherSettingsForm() {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const { t } = useTranslation('notification');

  const pushDisabled = PreferencePolicy.isPushDisabled(preference) || updateMutation.isPending;

  return (
    <VStack gap={24}>
      <SettingsCard>
        <SettingsToggle
          label={t('settings.weatherLabel')}
          description={
            PreferencePolicy.pushDisabledMessage(preference) ?? t('settings.weatherDescription')
          }
          isSelected={isWeatherEnabled(preference)}
          onSelectedChange={(enabled) =>
            updateMutation.mutate({
              weatherMorningEnabled: enabled,
              weatherEveningEnabled: enabled,
              trackAs: 'weatherEnabled',
            })
          }
          isDisabled={pushDisabled}
        />
        <Separator className="bg-gray-2" />
        <WeatherTimePicker
          label={t('settings.weatherMorningLabel')}
          description={t('settings.weatherMorningDescription')}
          field="morning"
        />
        <Separator className="bg-gray-2" />
        <WeatherTimePicker
          label={t('settings.weatherEveningLabel')}
          description={t('settings.weatherEveningDescription')}
          field="evening"
        />
      </SettingsCard>
    </VStack>
  );
}

WeatherSettingsForm.Loading = function Loading() {
  return <GroupSkeleton rows={3} />;
};

function WeatherTimePicker({
  label,
  description,
  field,
}: {
  label: string;
  description: string;
  field: 'morning' | 'evening';
}) {
  return (
    <SettingsTimePicker
      label={label}
      description={description}
      field={field}
      getHour={(p) => (field === 'morning' ? p.weatherMorningHour : p.weatherEveningHour)}
      getMinute={(p) => (field === 'morning' ? p.weatherMorningMinute : p.weatherEveningMinute)}
      buildMutationInput={(h, m) =>
        field === 'morning'
          ? { weatherMorningHour: h, weatherMorningMinute: m }
          : { weatherEveningHour: h, weatherEveningMinute: m }
      }
      isDisabled={PreferencePolicy.isWeatherDisabled}
    />
  );
}
