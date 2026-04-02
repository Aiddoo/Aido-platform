import { isWeatherEnabled, PreferencePolicy } from '@src/features/auth/models/auth.model';
import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/use-update-preference-mutation-options';
import {
  GroupSkeleton,
  SettingsCard,
  SettingsTimePicker,
  SettingsToggle,
} from '@src/features/notification/presentations/components/settings';
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

  const pushDisabled = PreferencePolicy.isPushDisabled(preference) || updateMutation.isPending;

  return (
    <VStack gap={24}>
      <SettingsCard>
        <SettingsToggle
          label="날씨 알림"
          description={PreferencePolicy.pushDisabledMessage(preference) ?? '날씨 알림을 받아요'}
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
          label="오전 날씨 알림"
          description="설정한 오전 시간에 오늘의 날씨를 알려줘요"
          field="morning"
        />
        <Separator className="bg-gray-2" />
        <WeatherTimePicker
          label="오후 날씨 알림"
          description="설정한 오후 시간에 내일의 날씨를 알려줘요"
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
