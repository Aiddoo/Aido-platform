import { PreferencePolicy } from '@src/features/identity/preference/domains/preference.model';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatTimeOfDay } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  BellDuoIcon,
  ReminderDuoIcon,
  SettingsListGroup,
  Text,
  TextSkeleton,
  WeatherDuoIcon,
} from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import { PUSH_SUMMARY_LABEL_KEYS } from '../../constants/notification-labels';
import { useGetPushPermissionQueryOptions } from '../../queries/push-permission.queries';
import { toPushSummary } from '../../utils/push-permission.view-model';

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

/** 섹션 이름(`label`) 같은 바깥 구성은 화면이 원본 SettingsListGroup props로 넘긴다 */
export function NotificationSettingsLinks(props: SettingsSectionProps) {
  const { t } = useTranslation('notification');
  const push = useSingleTap(router.push);
  const [{ data: preference }, { data: permission }] = useSuspenseQueries({
    queries: [useGetPreferenceQueryOptions(), useGetPushPermissionQueryOptions()],
  });
  const dateFormatContext = useDateFormatContext();
  const reminderTimes = [
    { hour: preference.morningReminderHour, minute: preference.morningReminderMinute },
    { hour: preference.eveningReminderHour, minute: preference.eveningReminderMinute },
  ]
    .map((time) => formatTimeOfDay(time, preference.timeFormat, dateFormatContext))
    .join(' / ');

  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item
        icon={<SettingsListGroup.Icon Icon={BellDuoIcon} />}
        label={t('settings.pushLabel')}
        value={
          <SummaryText>
            {t(PUSH_SUMMARY_LABEL_KEYS[toPushSummary(permission, preference)])}
          </SummaryText>
        }
        onPress={() => push('/settings/notifications/push')}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item
        icon={<SettingsListGroup.Icon Icon={ReminderDuoIcon} />}
        label={t('settings.reminderLabel')}
        value={<SummaryText>{reminderTimes}</SummaryText>}
        onPress={() => push('/settings/notifications/reminder')}
        isDisabled={!preference.pushEnabled}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item
        icon={<SettingsListGroup.Icon Icon={WeatherDuoIcon} />}
        label={t('settings.weatherLabel')}
        value={
          <SummaryText>
            {PreferencePolicy.isWeatherEnabled(preference) ? t('settings.on') : t('settings.off')}
          </SummaryText>
        }
        onPress={() => push('/settings/notifications/weather')}
        isDisabled={!preference.pushEnabled}
      />
    </SettingsListGroup>
  );
}

function SummaryText({ children }: { children: string }) {
  return (
    <Text size="b3" shade={7}>
      {children}
    </Text>
  );
}

/** 아이콘과 이름은 받기 전에도 같은 자리에 그려 값만 채워진다 */
NotificationSettingsLinks.Loading = function Loading(props: SettingsSectionProps) {
  const { t } = useTranslation('notification');

  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item
        icon={<SettingsListGroup.Icon Icon={BellDuoIcon} />}
        label={t('settings.pushLabel')}
        value={<TextSkeleton size="b3" className="w-12" />}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item
        icon={<SettingsListGroup.Icon Icon={ReminderDuoIcon} />}
        label={t('settings.reminderLabel')}
        value={<TextSkeleton size="b3" className="w-24" />}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item
        icon={<SettingsListGroup.Icon Icon={WeatherDuoIcon} />}
        label={t('settings.weatherLabel')}
        value={<TextSkeleton size="b3" className="w-12" />}
      />
    </SettingsListGroup>
  );
};
