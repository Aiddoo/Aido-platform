import DateTimePicker from '@react-native-community/datetimepicker';
import { isWeatherEnabled, PreferencePolicy } from '@src/features/auth/models/auth.model';
import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/use-update-preference-mutation-options';
import { PickerHeader } from '@src/features/todo/presentations/components/PickerHeader';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import {
  ArrowRightIcon,
  CrownIcon,
  HStack,
  KeyboardBottomSheet,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  useOverlay,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatReminderTime, type TimeFormat, timeToDate } from '@src/shared/utils/time';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import {
  ControlField,
  Description,
  Label,
  PressableFeedback,
  Separator,
  Skeleton,
  SkeletonGroup,
} from 'heroui-native';
import type React from 'react';
import { type ComponentProps, type PropsWithChildren, Suspense, useState } from 'react';
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
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());

  const pushDisabled = PreferencePolicy.isPushDisabled(preference) || updateMutation.isPending;

  return (
    <VStack gap={24}>
      <Card>
        <Toggle
          label="24시간제"
          isSelected={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
          onSelectedChange={(enabled) =>
            updateMutation.mutate({
              timeFormat: enabled ? 'TWENTY_FOUR_HOUR' : 'TWELVE_HOUR',
            })
          }
          isDisabled={updateMutation.isPending}
        />
      </Card>

      <Card>
        <Toggle
          label="푸시 알림"
          description="모든 푸시 알림을 받아요"
          isSelected={preference.pushEnabled}
          onSelectedChange={(enabled) => updateMutation.mutate({ pushEnabled: enabled })}
          isDisabled={updateMutation.isPending}
        />
        <Separator className="bg-gray-2" />
        <Toggle
          label="야간 푸시 알림"
          description={
            PreferencePolicy.pushDisabledMessage(preference) ??
            '21:00 - 08:00 시간대에도 알림을 받아요'
          }
          isSelected={preference.nightPushEnabled}
          onSelectedChange={(enabled) => {
            if (preference.pushEnabled) {
              updateMutation.mutate({ nightPushEnabled: enabled });
            }
          }}
          isDisabled={pushDisabled}
        />
      </Card>

      <SectionHeader
        title="날씨 알림"
        description={
          PreferencePolicy.weatherDisabledMessage(preference) ??
          '매일 설정한 시간에 날씨 정보를 알려줘요'
        }
      />
      <Card>
        <Toggle
          label="날씨 알림"
          description={PreferencePolicy.pushDisabledMessage(preference) ?? '날씨 알림을 받아요'}
          isSelected={isWeatherEnabled(preference)}
          onSelectedChange={(enabled) => {
            if (preference.pushEnabled) {
              updateMutation.mutate({
                weatherMorningEnabled: enabled,
                weatherEveningEnabled: enabled,
                trackAs: 'weatherEnabled',
              });
            }
          }}
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
      </Card>

      <SectionHeader
        title="리마인드 알림"
        description={
          PreferencePolicy.pushDisabledMessage(preference) ?? '매일 설정한 시간에 할일을 알려줘요'
        }
      />
      <Card>
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
      </Card>
    </VStack>
  );
}

NotificationSettingsForm.Loading = function Loading() {
  return (
    <VStack gap={24}>
      <Card>
        <ToggleSkeleton />
        <Separator className="bg-gray-2" />
        <ToggleSkeleton />
      </Card>
      <GroupSkeleton rows={2} />
      <GroupSkeleton rows={3} />
    </VStack>
  );
};

interface ReminderTimePickerProps {
  label: string;
  description: string;
  field: 'morning' | 'evening';
}

function ReminderTimePicker({ label, description, field }: ReminderTimePickerProps) {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();
  const overlay = useOverlay();
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  const disabled = PreferencePolicy.isPushDisabled(preference) || updateMutation.isPending;

  const hour =
    field === 'morning' ? preference.morningReminderHour : preference.eveningReminderHour;
  const minute =
    field === 'morning' ? preference.morningReminderMinute : preference.eveningReminderMinute;

  const handleTimeChange = (h: number, m: number) => {
    updateMutation.mutate(
      field === 'morning'
        ? { morningReminderHour: h, morningReminderMinute: m }
        : { eveningReminderHour: h, eveningReminderMinute: m },
    );
  };

  const handlePress = () => {
    if (disabled) return;

    if (!UserPolicy.isPremiumUser(user)) {
      trackEvent('premium_gate_shown', { feature: 'reminder_time' });
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
      timeFormat: preference.timeFormat,
      onConfirm: handleTimeChange,
    });
  };

  return (
    <VStack>
      <TimeRow
        label={label}
        description={description}
        hour={hour}
        minute={minute}
        timeFormat={preference.timeFormat}
        isDisabled={disabled}
        accessory={
          !UserPolicy.isPremiumUser(user) ? <CrownIcon width={14} height={14} /> : undefined
        }
        onPress={handlePress}
      />

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
          is24Hour={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
        />
      )}
    </VStack>
  );
}

interface WeatherTimePickerProps {
  label: string;
  description: string;
  field: 'morning' | 'evening';
}

function WeatherTimePicker({ label, description, field }: WeatherTimePickerProps) {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const overlay = useOverlay();
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  const disabled = PreferencePolicy.isWeatherDisabled(preference) || updateMutation.isPending;

  const hour = field === 'morning' ? preference.weatherMorningHour : preference.weatherEveningHour;
  const minute =
    field === 'morning' ? preference.weatherMorningMinute : preference.weatherEveningMinute;

  const handleTimeChange = (h: number, m: number) => {
    updateMutation.mutate(
      field === 'morning'
        ? { weatherMorningHour: h, weatherMorningMinute: m }
        : { weatherEveningHour: h, weatherEveningMinute: m },
    );
  };

  const handlePress = () => {
    if (disabled) return;

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
      timeFormat: preference.timeFormat,
      onConfirm: handleTimeChange,
    });
  };

  return (
    <VStack>
      <TimeRow
        label={label}
        description={description}
        hour={hour}
        minute={minute}
        timeFormat={preference.timeFormat}
        isDisabled={disabled}
        onPress={handlePress}
      />

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
          is24Hour={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
        />
      )}
    </VStack>
  );
}

function Card({ children }: PropsWithChildren) {
  return (
    <VStack p={16} gap={12} className="bg-white rounded-2xl">
      {children}
    </VStack>
  );
}

interface SectionHeaderProps {
  title: string;
  description: string;
}

function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <View className="px-2">
      <Label>{title}</Label>
      <Description>{description}</Description>
    </View>
  );
}

interface ToggleProps
  extends Pick<
    ComponentProps<typeof ControlField>,
    'isSelected' | 'onSelectedChange' | 'isDisabled'
  > {
  label: string;
  description?: string;
}

function Toggle({ label, description, isSelected, onSelectedChange, isDisabled }: ToggleProps) {
  return (
    <ControlField
      isSelected={isSelected}
      onSelectedChange={onSelectedChange}
      isDisabled={isDisabled}
    >
      <View className="flex-1">
        <Label>{label}</Label>
        {description && <Description>{description}</Description>}
      </View>
      <ControlField.Indicator />
    </ControlField>
  );
}

interface TimeRowProps
  extends Pick<ComponentProps<typeof PressableFeedback>, 'onPress' | 'isDisabled'> {
  label: string;
  description: string;
  hour: number;
  minute: number;
  timeFormat: TimeFormat;
  accessory?: React.ReactNode;
}

function TimeRow({
  label,
  description,
  hour,
  minute,
  timeFormat,
  isDisabled,
  accessory,
  onPress,
}: TimeRowProps) {
  return (
    <PressableFeedback onPress={onPress} isDisabled={isDisabled} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack justify="between" align="center" className={cn(isDisabled && 'opacity-40')} gap={20}>
        <VStack className="flex-1">
          <HStack gap={8} align="center">
            <Label>{label}</Label>
            {accessory}
            <Description className="text-main break-keep">
              {formatReminderTime(hour, minute, timeFormat)}
            </Description>
          </HStack>
          <Description lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
            {description}
          </Description>
        </VStack>
        <ArrowRightIcon colorClassName="text-gray-6" />
      </HStack>
    </PressableFeedback>
  );
}

function ToggleSkeleton() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack justify="between" align="center" className="py-2">
        <VStack flex={1} gap={2}>
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </VStack>
        <Skeleton className="h-8 w-14 rounded-full" />
      </HStack>
    </SkeletonGroup>
  );
}

function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <VStack gap={8}>
      <SkeletonGroup isLoading isSkeletonOnly>
        <VStack gap={2} className="px-2">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-4 w-52 rounded" />
        </VStack>
      </SkeletonGroup>

      <Card>
        <SkeletonGroup isLoading isSkeletonOnly>
          {times(rows, (i) => (
            <View key={i}>
              {i > 0 && <Separator className="bg-gray-2" />}
              <HStack justify="between" align="center" className="py-2">
                <VStack flex={1} gap={2}>
                  <Skeleton className="h-5 w-28 rounded" />
                  <Skeleton className="h-4 w-44 rounded" />
                </VStack>
                <Skeleton className="h-5 w-16 rounded" />
              </HStack>
            </View>
          ))}
        </SkeletonGroup>
      </Card>
    </VStack>
  );
}

function openTimePickerBottomSheet({
  label,
  field,
  hour,
  minute,
  overlay,
  timeFormat,
  onConfirm,
}: {
  label: string;
  field: 'morning' | 'evening';
  hour: number;
  minute: number;
  overlay: ReturnType<typeof useOverlay>;
  timeFormat: TimeFormat;
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
        <View style={{ height: 216, alignItems: 'center' }}>
          <DateTimePicker
            value={tempDate}
            minimumDate={timeToDate(field === 'evening' ? 12 : 0, 0)}
            maximumDate={timeToDate(field === 'morning' ? 11 : 23, 59)}
            onChange={(_event, date) => {
              if (date) {
                tempDate = date;
              }
            }}
            mode="time"
            display="spinner"
            minuteInterval={1}
            is24Hour={timeFormat === 'TWENTY_FOUR_HOUR'}
            locale={timeFormat === 'TWENTY_FOUR_HOUR' ? 'en_GB' : 'ko'}
            style={{ height: 216 }}
          />
        </View>
      </VStack>
    </KeyboardBottomSheet>
  ));
}
