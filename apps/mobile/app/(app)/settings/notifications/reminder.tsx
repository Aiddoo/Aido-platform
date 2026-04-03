import { PreferencePolicy } from '@src/features/auth/models/auth.model';
import {
  GroupSkeleton,
  SettingsCard,
  SettingsTimePicker,
} from '@src/features/notification/presentations/components/settings';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import {
  CrownIcon,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function ReminderSettingsScreen() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />
        <QueryErrorBoundary>
          <Suspense fallback={<ReminderSettingsForm.Loading />}>
            <ReminderSettingsForm />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

function ReminderSettingsForm() {
  return (
    <VStack gap={24}>
      <SettingsCard>
        <ReminderTimePicker
          label="오전 리마인드"
          description="오전 시간대(00:00~11:59)에 오늘의 할일을 알려줘요"
          field="morning"
        />
        <Separator className="bg-gray-2" />
        <ReminderTimePicker
          label="오후 리마인드"
          description="오후 시간대(12:00~23:59)에 남은 할일을 알려줘요"
          field="evening"
        />
      </SettingsCard>
    </VStack>
  );
}

ReminderSettingsForm.Loading = function Loading() {
  return <GroupSkeleton rows={2} />;
};

function ReminderTimePicker({
  label,
  description,
  field,
}: {
  label: string;
  description: string;
  field: 'morning' | 'evening';
}) {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();

  return (
    <SettingsTimePicker
      label={label}
      description={description}
      field={field}
      getHour={(p) => (field === 'morning' ? p.morningReminderHour : p.eveningReminderHour)}
      getMinute={(p) => (field === 'morning' ? p.morningReminderMinute : p.eveningReminderMinute)}
      buildMutationInput={(h, m) =>
        field === 'morning'
          ? { morningReminderHour: h, morningReminderMinute: m }
          : { eveningReminderHour: h, eveningReminderMinute: m }
      }
      isDisabled={PreferencePolicy.isPushDisabled}
      onBeforeOpen={() => {
        if (!UserPolicy.isPremiumUser(user)) {
          trackEvent('premium_gate_shown', { feature: 'reminder_time' });
          premiumDialog.open({
            description: '리마인드 시간 변경은 프리미엄 구독자만 이용할 수 있어요.',
          });
          return false;
        }
        return true;
      }}
      accessory={!UserPolicy.isPremiumUser(user) ? <CrownIcon width={14} height={14} /> : undefined}
    />
  );
}
