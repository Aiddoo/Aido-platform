import { getPreferenceQueryOptions } from '@src/features/auth/presentations/queries/get-preference-query-options';
import { updatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/update-preference-mutation-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { ConfirmDialog } from '@src/shared/ui/ConfirmDialog';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowRightIcon } from '@src/shared/ui/Icon';
import { useOverlay } from '@src/shared/ui/Overlay';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils/cn';
import { formatReminderHour, hourToDate } from '@src/shared/utils/time';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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
import { ScrollView, View } from 'react-native';
import DatePicker from 'react-native-date-picker';

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
  const { data: preference } = useSuspenseQuery(getPreferenceQueryOptions());
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const updateMutation = useMutation(updatePreferenceMutationOptions());

  const isPremium = UserPolicy.isPremiumUser(user);

  return (
    <VStack gap={12}>
      <PushSettingsSection
        preference={preference}
        isPending={updateMutation.isPending}
        onToggle={(input) => updateMutation.mutate(input)}
      />

      <ReminderSection
        preference={preference}
        isPremium={isPremium}
        isPending={updateMutation.isPending}
        onTimeChange={(input) => updateMutation.mutate(input)}
      />
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

interface PushSettingsSectionProps {
  preference: { pushEnabled: boolean; nightPushEnabled: boolean };
  isPending: boolean;
  onToggle: (input: { pushEnabled?: boolean; nightPushEnabled?: boolean }) => void;
}

function PushSettingsSection({ preference, isPending, onToggle }: PushSettingsSectionProps) {
  return (
    <VStack p={16} gap={12} className="bg-white rounded-2xl">
      <ControlField
        isSelected={preference.pushEnabled}
        onSelectedChange={(enabled) => onToggle({ pushEnabled: enabled })}
        isDisabled={isPending}
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
          onToggle({ nightPushEnabled: enabled });
        }}
        isDisabled={isPending || !preference.pushEnabled}
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

interface ReminderSectionProps {
  preference: {
    pushEnabled: boolean;
    morningReminderHour: number;
    eveningReminderHour: number;
  };
  isPremium: boolean;
  isPending: boolean;
  onTimeChange: (input: { morningReminderHour?: number; eveningReminderHour?: number }) => void;
}

function ReminderSection({ preference, isPremium, isPending, onTimeChange }: ReminderSectionProps) {
  const router = useRouter();
  const overlay = useOverlay();
  const [pickerConfig, setPickerConfig] = useState<{
    open: boolean;
    field: 'morningReminderHour' | 'eveningReminderHour';
    currentHour: number;
  }>({ open: false, field: 'morningReminderHour', currentHour: 8 });

  const disabled = !preference.pushEnabled || isPending;

  const handlePress = (field: typeof pickerConfig.field, currentHour: number) => {
    if (disabled) return;

    if (!isPremium) {
      overlay.open(({ isOpen, close, exit }) => (
        <PremiumReminderLockDialog
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              exit();
            }
          }}
          onSubscribe={() => {
            close();
            exit();
            router.push('/settings/subscription');
          }}
        />
      ));
      return;
    }

    setPickerConfig({ open: true, field, currentHour });
  };

  return (
    <VStack p={16} gap={12} className="bg-white rounded-2xl">
      <View>
        <Label>리마인드 알림</Label>
        <Description>
          {preference.pushEnabled
            ? '매일 설정한 시간에 할일을 알려줘요'
            : '푸시 알림을 먼저 활성화해주세요'}
        </Description>
      </View>

      <Separator className="bg-gray-2" />

      <ReminderTimeRow
        label="오전 리마인드"
        hour={preference.morningReminderHour}
        disabled={disabled}
        onPress={() => handlePress('morningReminderHour', preference.morningReminderHour)}
      />

      <Separator className="bg-gray-2" />

      <ReminderTimeRow
        label="오후 리마인드"
        hour={preference.eveningReminderHour}
        disabled={disabled}
        onPress={() => handlePress('eveningReminderHour', preference.eveningReminderHour)}
      />

      <DatePicker
        modal
        open={pickerConfig.open}
        date={hourToDate(pickerConfig.currentHour)}
        minimumDate={hourToDate(pickerConfig.field === 'morningReminderHour' ? 0 : 12)}
        maximumDate={hourToDate(pickerConfig.field === 'morningReminderHour' ? 11 : 23)}
        onConfirm={(date) => {
          setPickerConfig((prev) => ({ ...prev, open: false }));
          onTimeChange({ [pickerConfig.field]: date.getHours() });
        }}
        onCancel={() => setPickerConfig((prev) => ({ ...prev, open: false }))}
        mode="time"
        minuteInterval={30}
        title={pickerConfig.field === 'morningReminderHour' ? '오전 시간 선택' : '오후 시간 선택'}
        confirmText="확인"
        cancelText="취소"
        locale={Intl.DateTimeFormat().resolvedOptions().locale}
      />
    </VStack>
  );
}

interface ReminderTimeRowProps {
  label: string;
  hour: number;
  disabled: boolean;
  onPress: () => void;
}

function ReminderTimeRow({ label, hour, disabled, onPress }: ReminderTimeRowProps) {
  return (
    <PressableFeedback onPress={onPress} isDisabled={disabled} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack py={12} justify="between" align="center" className={cn(disabled && 'opacity-40')}>
        <Label>{label}</Label>
        <HStack gap={4} align="center">
          <Description>{formatReminderHour(hour)}</Description>
          <ArrowRightIcon colorClassName="text-gray-6" />
        </HStack>
      </HStack>
    </PressableFeedback>
  );
}

interface PremiumReminderLockDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubscribe: () => void;
}

function PremiumReminderLockDialog({
  isOpen,
  onOpenChange,
  onSubscribe,
}: PremiumReminderLockDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>프리미엄 기능</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>
          리마인드 시간 변경은 프리미엄 구독자만 이용할 수 있어요.
        </ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)}>
          닫기
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={onSubscribe}>구독하기</ConfirmDialog.ConfirmButton>
      }
    />
  );
}
