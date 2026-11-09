import { PreferencePolicy } from '@src/features/identity/preference/domains/preference.model';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatTimeOfDay } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup, Text } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import { PushPermissionPolicy } from '../../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../../queries/notification.queries';

function SummaryText({ isEnabled, children }: { isEnabled: boolean; children: string }) {
  return (
    <Text size="b2" className={isEnabled ? 'text-main' : 'text-gray-5'}>
      {children}
    </Text>
  );
}

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

/** 섹션 이름(`label`) 같은 바깥 구성은 화면이 원본 SettingsListGroup props로 넘긴다 */
export function NotificationSettingsLinks(props: SettingsSectionProps) {
  const { t } = useTranslation('notification');
  const push = useSingleTap(router.push);
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const { data: permission } = useSuspenseQuery(useGetPushPermissionQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const isPushEnabled = preference.pushEnabled;
  // 서버 설정은 그대로 두고, 기기 알림이 꺼져 닿지 않는다는 것만 회색과 문구로 보인다
  const isDeviceOff = isPushEnabled && !PushPermissionPolicy.isPushDeliverable(permission);
  const canReceivePush = PushPermissionPolicy.canReceivePush(permission, {
    pushEnabled: isPushEnabled,
  });
  const isWeatherEnabled = PreferencePolicy.isWeatherEnabled(preference);

  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item
        label={t('settings.pushLabel')}
        value={
          <SummaryText isEnabled={canReceivePush}>
            {isDeviceOff
              ? t('settings.deviceOff')
              : isPushEnabled
                ? t('settings.on')
                : t('settings.off')}
          </SummaryText>
        }
        onPress={() => push('/settings/notifications/push')}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item
        label={t('settings.weatherLabel')}
        value={
          <SummaryText isEnabled={canReceivePush && isWeatherEnabled}>
            {isWeatherEnabled ? t('settings.on') : t('settings.off')}
          </SummaryText>
        }
        onPress={() => push('/settings/notifications/weather')}
        isDisabled={!isPushEnabled}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item
        label={t('settings.reminderLabel')}
        value={
          <SummaryText isEnabled={canReceivePush}>
            {[
              { hour: preference.morningReminderHour, minute: preference.morningReminderMinute },
              { hour: preference.eveningReminderHour, minute: preference.eveningReminderMinute },
            ]
              .map((time) => formatTimeOfDay(time, preference.timeFormat, dateFormatContext))
              .join(' / ')}
          </SummaryText>
        }
        onPress={() => push('/settings/notifications/reminder')}
        isDisabled={!isPushEnabled}
      />
    </SettingsListGroup>
  );
}
