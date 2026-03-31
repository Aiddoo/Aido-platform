import type { UpdatePreferenceInput } from '@aido/validators';
import DateTimePicker, {
  type AndroidNativeProps,
  type IOSNativeProps,
} from '@react-native-community/datetimepicker';
import {
  isWeatherEnabled,
  type Preference,
  PreferencePolicy,
} from '@src/features/auth/models/auth.model';
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
          onSelectedChange={(enabled) => updateMutation.mutate({ nightPushEnabled: enabled })}
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

type TimePickerProps = Omit<IOSNativeProps, 'mode' | 'display' | 'minuteInterval'>;

function TimePicker({ style, ...props }: TimePickerProps) {
  return (
    <DateTimePicker
      {...props}
      mode="time"
      display="spinner"
      minuteInterval={1}
      style={[{ height: 216 }, style]}
    />
  );
}

interface AndroidTimePickerProps
  extends Omit<AndroidNativeProps, 'mode' | 'display' | 'minuteInterval' | 'onChange'> {
  onConfirm: (date: Date) => void;
  onDismiss: () => void;
}

function AndroidTimePicker({ onConfirm, onDismiss, ...props }: AndroidTimePickerProps) {
  return (
    <DateTimePicker
      {...props}
      mode="time"
      display="spinner"
      minuteInterval={1}
      onChange={(event, date) => {
        onDismiss();
        if (event.type === 'set' && date) onConfirm(date);
      }}
    />
  );
}

interface SettingsTimePickerProps {
  label: string;
  description: string;
  field: 'morning' | 'evening';
  getHour: (preference: Preference) => number;
  getMinute: (preference: Preference) => number;
  buildMutationInput: (hour: number, minute: number) => UpdatePreferenceInput;
  isDisabled: (preference: Preference) => boolean;
  onBeforeOpen?: () => boolean;
  accessory?: React.ReactNode;
}

function SettingsTimePicker({
  label,
  description,
  field,
  getHour,
  getMinute,
  buildMutationInput,
  isDisabled: checkDisabled,
  onBeforeOpen,
  accessory,
}: SettingsTimePickerProps) {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const overlay = useOverlay();
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  const disabled = checkDisabled(preference) || updateMutation.isPending;
  const hour = getHour(preference);
  const minute = getMinute(preference);

  const handleTimeChange = (h: number, m: number) => {
    updateMutation.mutate(buildMutationInput(h, m));
  };

  const handlePress = () => {
    if (disabled) return;
    if (onBeforeOpen && !onBeforeOpen()) return;

    if (Platform.OS === 'android') {
      setAndroidPickerOpen(true);
      return;
    }

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
              handleTimeChange(tempDate.getHours(), tempDate.getMinutes());
              close();
              exit();
            }}
          />
          <View style={{ height: 216, alignItems: 'center' }}>
            <TimePicker
              value={tempDate}
              minimumDate={timeToDate(field === 'morning' ? 0 : 12, 0)}
              maximumDate={timeToDate(field === 'morning' ? 11 : 23, 59)}
              onChange={(_event, date) => {
                if (date) tempDate = date;
              }}
              locale={preference.timeFormat === 'TWENTY_FOUR_HOUR' ? 'en_GB' : 'ko'}
            />
          </View>
        </VStack>
      </KeyboardBottomSheet>
    ));
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
        accessory={accessory}
        onPress={handlePress}
      />
      {androidPickerOpen && (
        <AndroidTimePicker
          value={timeToDate(hour, minute)}
          minimumDate={timeToDate(field === 'morning' ? 0 : 12, 0)}
          maximumDate={timeToDate(field === 'morning' ? 11 : 23, 59)}
          is24Hour={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
          onConfirm={(date) => handleTimeChange(date.getHours(), date.getMinutes())}
          onDismiss={() => setAndroidPickerOpen(false)}
        />
      )}
    </VStack>
  );
}

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
