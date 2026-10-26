import { SettingsCard } from '@src/features/notification/components/settings/settings-card';
import {
  NavigationSkeleton,
  ToggleSkeleton,
} from '@src/features/notification/components/settings/settings-skeleton';
import { SettingsToggle } from '@src/features/notification/components/settings/settings-toggle';
import { PreferencePolicy } from '@src/features/preference/domains/preference.model';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/preference/queries/use-update-preference-mutation-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  HStack,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatTimeOfDay } from '@src/shared/utils/date-format';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback, Separator } from 'heroui-native';
import { type ComponentProps, Suspense } from 'react';
import { ScrollView } from 'react-native';

interface NavigationRowProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  summary: string;
  isSummaryEnabled?: boolean;
}

function NavigationRow({
  label,
  summary,
  isSummaryEnabled,
  isDisabled,
  className,
  ...pressableProps
}: NavigationRowProps) {
  return (
    <PressableFeedback
      isDisabled={isDisabled}
      className={cn('rounded-lg', className)}
      {...pressableProps}
    >
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack
        justify="between"
        align="center"
        className={cn('py-2', isDisabled && 'opacity-40')}
        gap={20}
      >
        <Text size="b2" shade={8}>
          {label}
        </Text>
        <HStack gap={8} align="center">
          <Text size="b2" className={isSummaryEnabled ? 'text-main' : 'text-gray-5'}>
            {summary}
          </Text>
          <ArrowRightIcon colorClassName="text-gray-6" />
        </HStack>
      </HStack>
    </PressableFeedback>
  );
}

function NotificationSettingsScreen() {
  const push = useSingleTap(router.push);

  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const { t } = useTranslation('notification');
  const dateFormatContext = useDateFormatContext();

  const isPushDisabled = PreferencePolicy.isPushDisabled(preference);

  return (
    <VStack gap={24}>
      <SettingsCard>
        <SettingsToggle
          label={t('settings.timeFormat24')}
          isSelected={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
          onSelectedChange={(isEnabled) =>
            updateMutation.mutate({
              timeFormat: isEnabled ? 'TWENTY_FOUR_HOUR' : 'TWELVE_HOUR',
            })
          }
          isDisabled={updateMutation.isPending}
        />
      </SettingsCard>

      <SettingsCard>
        <NavigationRow
          label={t('settings.pushLabel')}
          summary={preference.pushEnabled ? t('settings.on') : t('settings.off')}
          isSummaryEnabled={preference.pushEnabled}
          onPress={() => push('/settings/notifications/push')}
        />
        <Separator className="bg-gray-2" />
        <NavigationRow
          label={t('settings.weatherLabel')}
          summary={
            PreferencePolicy.isWeatherEnabled(preference) ? t('settings.on') : t('settings.off')
          }
          isSummaryEnabled={PreferencePolicy.isWeatherEnabled(preference)}
          onPress={() => push('/settings/notifications/weather')}
          isDisabled={isPushDisabled}
        />
        <Separator className="bg-gray-2" />
        <NavigationRow
          label={t('settings.reminderLabel')}
          summary={[
            { hour: preference.morningReminderHour, minute: preference.morningReminderMinute },
            { hour: preference.eveningReminderHour, minute: preference.eveningReminderMinute },
          ]
            .map((time) => formatTimeOfDay(time, preference.timeFormat, dateFormatContext))
            .join(' / ')}
          isSummaryEnabled={!isPushDisabled}
          onPress={() => push('/settings/notifications/reminder')}
          isDisabled={isPushDisabled}
        />
      </SettingsCard>
    </VStack>
  );
}

NotificationSettingsScreen.Loading = function Loading() {
  return (
    <VStack gap={24}>
      <SettingsCard>
        <ToggleSkeleton />
      </SettingsCard>

      <SettingsCard>
        <NavigationSkeleton />
        <Separator className="bg-gray-2" />
        <NavigationSkeleton />
        <Separator className="bg-gray-2" />
        <NavigationSkeleton />
      </SettingsCard>
    </VStack>
  );
};

export default function NotificationSettingsRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={20} />
          <QueryErrorBoundary>
            <Suspense fallback={<NotificationSettingsScreen.Loading />}>
              <NotificationSettingsScreen />
            </Suspense>
          </QueryErrorBoundary>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
