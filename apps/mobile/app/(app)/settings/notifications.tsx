import DateTimePicker from '@react-native-community/datetimepicker';
import { getPreferenceQueryOptions } from '@src/features/auth/presentations/queries/get-preference-query-options';
import { updatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/update-preference-mutation-options';
import { PickerHeader } from '@src/features/todo/presentations/components/PickerHeader';
import { UserPolicy } from '@src/features/user/models/user.model';
import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowRightIcon } from '@src/shared/ui/Icon';
import { useOverlay } from '@src/shared/ui/Overlay';
import { usePremiumDialog } from '@src/shared/ui/PremiumDialog';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils/cn';
import { formatReminderTime, timeToDate } from '@src/shared/utils/time';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import {
  ControlField,
  Description,
  Label,
  PressableFeedback,
  Separator,
  Skeleton,
  SkeletonGroup,
} from 'heroui-native';
import { Suspense, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';

const NotificationSettingsScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />

        <QueryErrorBoundary>
          <Suspense fallback={<NotificationSettingsForm.Loading />}>
            <NotificationSettingsForm />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default NotificationSettingsScreen;

function NotificationSettingsForm() {
  return (
    <VStack gap={24}>
      <PushSettingsSection />

      <ReminderSection />
    </VStack>
  );
}

NotificationSettingsForm.Loading = function Loading() {
  return (
    <VStack gap={12}>
      <VStack p={16} gap={12} className="bg-white rounded-2xl">
        <SkeletonGroup isLoading isSkeletonOnly>
          <HStack justify="between" align="center" className="py-2">
            <VStack flex={1} gap={2}>
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
            </VStack>

            <Skeleton className="h-8 w-14 rounded-full" />
          </HStack>

          <Separator className="bg-gray-2" />

          <HStack justify="between" align="center" className="py-2">
            <VStack flex={1} gap={2}>
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-56 rounded" />
            </VStack>

            <Skeleton className="h-8 w-14 rounded-full" />
          </HStack>
        </SkeletonGroup>
      </VStack>

      <VStack p={16} gap={12} className="bg-white rounded-2xl">
        <SkeletonGroup isLoading isSkeletonOnly>
          <VStack gap={2}>
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-4 w-52 rounded" />
          </VStack>

          <HStack justify="between" align="center" className="py-2">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </HStack>

          <Separator className="bg-gray-2" />

          <HStack justify="between" align="center" className="py-2">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </HStack>
        </SkeletonGroup>
      </VStack>
    </VStack>
  );
};

function PushSettingsSection() {
  const { data: preference } = useSuspenseQuery(getPreferenceQueryOptions());
  const updateMutation = useMutation(updatePreferenceMutationOptions());

  return (
    <VStack p={16} gap={12} className="bg-white rounded-2xl">
      <ControlField
        isSelected={preference.pushEnabled}
        onSelectedChange={(enabled) => updateMutation.mutate({ pushEnabled: enabled })}
        isDisabled={updateMutation.isPending}
      >
        <View className="flex-1">
          <Label>푸시 알림</Label>
          <Description>모든 푸시 알림을 받습니다</Description>
        </View>
        <ControlField.Indicator />
      </ControlField>

      <Separator className="bg-gray-2" />

      <ControlField
        isSelected={preference.nightPushEnabled}
        onSelectedChange={(enabled) => {
          if (!preference.pushEnabled) return;
          updateMutation.mutate({ nightPushEnabled: enabled });
        }}
        isDisabled={updateMutation.isPending || !preference.pushEnabled}
      >
        <View className="flex-1">
          <Label>야간 푸시 알림</Label>
          <Description>
            {preference.pushEnabled
              ? '21:00 - 08:00 시간대에도 알림을 받습니다'
              : '푸시 알림을 먼저 활성화해주세요'}
          </Description>
        </View>
        <ControlField.Indicator />
      </ControlField>
    </VStack>
  );
}

function ReminderSection() {
  const { data: preference } = useSuspenseQuery(getPreferenceQueryOptions());

  return (
    <VStack gap={8}>
      <View className="px-2">
        <Label>리마인드 알림</Label>
        <Description>
          {preference.pushEnabled
            ? '매일 설정한 시간에 할일을 알려줘요'
            : '푸시 알림을 먼저 활성화해주세요'}
        </Description>
      </View>

      <VStack p={16} gap={12} className="bg-white rounded-2xl">
        <ReminderTimeRow
          label="오전 리마인드"
          description="오전 시간대(0:00~11:59)에 오늘의 할일을 알려줘요"
          field="morning"
        />

        <Separator className="bg-gray-2" />

        <ReminderTimeRow
          label="오후 리마인드"
          description="오후 시간대(12:00~23:59)에 남은 할일을 알려줘요"
          field="evening"
        />
      </VStack>
    </VStack>
  );
}

interface ReminderTimeRowProps {
  label: string;
  description: string;
  field: 'morning' | 'evening';
}

function ReminderTimeRow({ label, description, field }: ReminderTimeRowProps) {
  const { data: preference } = useSuspenseQuery(getPreferenceQueryOptions());
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const updateMutation = useMutation(updatePreferenceMutationOptions());
  const premiumDialog = usePremiumDialog();
  const overlay = useOverlay();
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  const isPremium = UserPolicy.isPremiumUser(user);
  const disabled = !preference.pushEnabled || updateMutation.isPending;
  const hour =
    field === 'morning' ? preference.morningReminderHour : preference.eveningReminderHour;
  const minute =
    field === 'morning' ? preference.morningReminderMinute : preference.eveningReminderMinute;

  const handleTimeChange = (h: number, m: number) => {
    const input =
      field === 'morning'
        ? { morningReminderHour: h, morningReminderMinute: m }
        : { eveningReminderHour: h, eveningReminderMinute: m };
    updateMutation.mutate(input);
  };

  const handlePress = () => {
    if (disabled) return;

    if (!isPremium) {
      premiumDialog.open({
        description: '리마인드 시간 변경은 프리미엄 구독자만 이용할 수 있어요.',
      });
      return;
    }

    if (Platform.OS === 'android') {
      setAndroidPickerOpen(true);
      return;
    }

    openTimePickerBottomSheet({
      label,
      field,
      hour,
      minute,
      overlay,
      onConfirm: handleTimeChange,
    });
  };

  return (
    <VStack>
      <PressableFeedback onPress={handlePress} isDisabled={disabled} className="rounded-lg">
        <PressableFeedback.Highlight className="rounded-lg" />

        <HStack justify="between" align="center" className={cn(disabled && 'opacity-40')} gap={20}>
          <VStack className="flex-1">
            <HStack gap={8} align="center">
              <Label>{label}</Label>
              <Description className="text-main break-keep">
                {formatReminderTime(hour, minute)}
              </Description>
            </HStack>
            <Description lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
              {description}
            </Description>
          </VStack>

          <ArrowRightIcon colorClassName="text-gray-6" />
        </HStack>
      </PressableFeedback>

      {androidPickerOpen && (
        <DateTimePicker
          value={timeToDate(hour, minute)}
          minimumDate={timeToDate(field === 'morning' ? 0 : 12, 0)}
          maximumDate={timeToDate(field === 'morning' ? 11 : 23, 59)}
          onChange={(event, date) => {
            setAndroidPickerOpen(false);

            if (event.type === 'set' && date) {
              handleTimeChange(date.getHours(), date.getMinutes());
            }
          }}
          mode="time"
          display="spinner"
          minuteInterval={1}
        />
      )}
    </VStack>
  );
}

function openTimePickerBottomSheet({
  label,
  field,
  hour,
  minute,
  overlay,
  onConfirm,
}: {
  label: string;
  field: 'morning' | 'evening';
  hour: number;
  minute: number;
  overlay: ReturnType<typeof useOverlay>;
  onConfirm: (hour: number, minute: number) => void;
}) {
  let tempDate = timeToDate(hour, minute);

  overlay.open(({ isOpen, close, exit }) => (
    <KeyboardBottomSheet
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          close();
          exit();
        }
      }}
    >
      <VStack gap={24}>
        <PickerHeader
          title={label}
          onCancel={() => {
            close();
            exit();
          }}
          onConfirm={() => {
            onConfirm(tempDate.getHours(), tempDate.getMinutes());
            close();
            exit();
          }}
        />
        <View style={{ height: 216 }}>
          <DateTimePicker
            value={tempDate}
            minimumDate={timeToDate(field === 'morning' ? 0 : 12, 0)}
            maximumDate={timeToDate(field === 'morning' ? 11 : 23, 59)}
            onChange={(_event, date) => {
              if (date) {
                tempDate = date;
              }
            }}
            mode="time"
            display="spinner"
            minuteInterval={1}
            locale={Intl.DateTimeFormat().resolvedOptions().locale}
            style={{ height: 216 }}
          />
        </View>
      </VStack>
    </KeyboardBottomSheet>
  ));
}
