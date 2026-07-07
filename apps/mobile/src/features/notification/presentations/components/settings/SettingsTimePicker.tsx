import type { UpdatePreferenceInput } from '@aido/validators';
import DateTimePicker, {
  type AndroidNativeProps,
  type IOSNativeProps,
} from '@react-native-community/datetimepicker';
import type { Preference } from '@src/features/auth/models/auth.model';
import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/use-update-preference-mutation-options';
import { PickerHeader } from '@src/features/todo/presentations/components/PickerHeader';
import { useLanguage } from '@src/shared/providers/language-provider';
import { KeyboardBottomSheet, useOverlay, VStack } from '@src/shared/ui';
import { getPickerLocale, timeToDate } from '@src/shared/utils/time';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { SettingsTimeRow } from './SettingsTimeRow';

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
        if (event.type === 'set' && date) {
          onConfirm(date);
        }
      }}
    />
  );
}

export interface SettingsTimePickerProps {
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

export function SettingsTimePicker({
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
  const { resolvedLanguage } = useLanguage();
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
    if (disabled) {
      return;
    }
    if (onBeforeOpen && !onBeforeOpen()) {
      return;
    }

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
                if (date) {
                  tempDate = date;
                }
              }}
              locale={getPickerLocale(resolvedLanguage, preference.timeFormat)}
            />
          </View>
        </VStack>
      </KeyboardBottomSheet>
    ));
  };

  return (
    <VStack>
      <SettingsTimeRow
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
