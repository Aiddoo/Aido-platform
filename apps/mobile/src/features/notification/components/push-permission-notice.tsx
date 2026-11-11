import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { toHHmm } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { Button, InlineAlert } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { useEffect } from 'react';
import { match } from 'ts-pattern';

import { PUSH_ASK_MOMENT, PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import {
  useOpenPushSettingsMutationOptions,
  useRequestPushPermissionMutationOptions,
} from '../queries/notification.mutations';
import { useGetPushPermissionQueryOptions } from '../queries/notification.queries';
import { pushNoticeDismissedAtStoredValue } from '../schemas/push-notice-dismissed-at-storage.schema';

const SOURCE: PushPermissionPromptSource = 'feed_card';

interface PushPermissionNoticeProps {
  className?: string;
}

/** 알림을 거절했고 오늘 알림이 갈 할 일이 남아 있을 때만 보인다. 닫으면 계정마다 14일 동안 숨긴다 */
export function PushPermissionNotice({ className }: PushPermissionNoticeProps) {
  const todayKey = useTodayKey();
  const [{ data: permission }, { data: preference }, { data: me }, { data: todayTodos }] =
    useSuspenseQueries({
      queries: [
        useGetPushPermissionQueryOptions(),
        useGetPreferenceQueryOptions(),
        useGetMeQueryOptions(),
        useGetTodosByDateQueryOptions({ date: todayKey }),
      ],
    });
  const [noticeDismissedAt, setNoticeDismissedAt] = useStoredValue(
    pushNoticeDismissedAtStoredValue,
    me.id,
  );
  const { timeZone } = useDateFormatContext();
  const now = useMinuteNow();
  const { trackEvent } = useTrack();
  const isVisible =
    PushPermissionPolicy.getAskMoment(permission, {
      surface: 'feed',
      hasUpcomingTimedTodo: TodoPolicy.hasUpcomingTimedTodo(todayTodos.todos, {
        dateKey: todayKey,
        time: toHHmm(now, timeZone),
        timeZone,
      }),
      prompt: { noticeDismissedAt },
      now,
    }) === PUSH_ASK_MOMENT.DENIED_NOTICE;
  const step = PushPermissionPolicy.getNextStep(permission, preference);

  useEffect(() => {
    if (isVisible) {
      trackEvent('push_permission_prompt_shown', { source: SOURCE, step });
    }
  }, [isVisible, step, trackEvent]);

  if (!isVisible) {
    return null;
  }

  const dismiss = () => {
    trackEvent('push_permission_prompt_dismissed', { source: SOURCE, step });
    setNoticeDismissedAt(getNowInstant());
  };

  return match(step)
    .with(PUSH_PERMISSION_STEP.REQUEST_SYSTEM, () => (
      <PushPermissionNotice.RequestSystem className={className} onDismiss={dismiss} />
    ))
    .with(PUSH_PERMISSION_STEP.OPEN_SETTINGS, () => (
      <PushPermissionNotice.OpenSettings className={className} onDismiss={dismiss} />
    ))
    .with(
      PUSH_PERMISSION_STEP.ASK,
      PUSH_PERMISSION_STEP.ENABLE_IN_APP,
      PUSH_PERMISSION_STEP.NONE,
      () => null,
    )
    .exhaustive();
}

interface StepNoticeProps {
  className?: string;
  onDismiss: () => void;
}

PushPermissionNotice.RequestSystem = function RequestSystem({
  className,
  onDismiss,
}: StepNoticeProps) {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const requestPermission = useMutation(useRequestPushPermissionMutationOptions());

  return (
    <InlineAlert
      className={className}
      image={null}
      title={t('permission.card.deniedTitle')}
      description={t('permission.card.requestDescription')}
      action={
        <Button
          size="small"
          variant="weak"
          display="inline"
          isLoading={requestPermission.isPending}
          onPress={() =>
            requestPermission.mutate(undefined, {
              onSuccess: (permission) =>
                trackEvent('push_permission_requested', {
                  source: SOURCE,
                  status: permission.status,
                }),
            })
          }
        >
          {t('permission.continue')}
        </Button>
      }
      onClose={onDismiss}
      closeLabel={t('permission.card.dismiss')}
    />
  );
};

PushPermissionNotice.OpenSettings = function OpenSettings({
  className,
  onDismiss,
}: StepNoticeProps) {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const openSettings = useMutation(useOpenPushSettingsMutationOptions());

  return (
    <InlineAlert
      className={className}
      image={null}
      title={t('permission.card.deniedTitle')}
      description={t('permission.card.settingsDescription')}
      action={
        <Button
          size="small"
          variant="weak"
          display="inline"
          onPress={() =>
            openSettings.mutate(undefined, {
              onSuccess: () => trackEvent('push_permission_settings_opened', { source: SOURCE }),
            })
          }
        >
          {t('permission.card.openSettings')}
        </Button>
      }
      onClose={onDismiss}
      closeLabel={t('permission.card.dismiss')}
    />
  );
};
