import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTrack } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Button, InlineAlert } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { match } from 'ts-pattern';

import { PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import { usePushPromptSnooze } from '../hooks/use-push-prompt-snooze';
import {
  useOpenPushSettingsMutationOptions,
  useRequestPushPermissionMutationOptions,
} from '../queries/notification.mutations';
import { useGetPushPermissionQueryOptions } from '../queries/notification.queries';
import { PushPermissionDialog } from './push-permission-dialog';

const SOURCE: PushPermissionPromptSource = 'feed_card';

interface PushPermissionNoticeProps {
  className?: string;
}

/** 이 기기로 알림이 닿지 않을 때 다음 할 일을 알려 준다. 닫으면 14일 동안 숨긴다 */
export function PushPermissionNotice({ className }: PushPermissionNoticeProps) {
  const [{ data: permission }, { data: preference }] = useSuspenseQueries({
    queries: [useGetPushPermissionQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const [isSnoozed, snooze] = usePushPromptSnooze();
  const { trackEvent } = useTrack();
  const step = PushPermissionPolicy.getNextStep(permission, preference);
  const isVisible = !isSnoozed && step !== PUSH_PERMISSION_STEP.NONE;

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
    snooze();
  };

  return match(step)
    .with(PUSH_PERMISSION_STEP.ASK, () => (
      <PushPermissionNotice.Ask className={className} onDismiss={dismiss} />
    ))
    .with(PUSH_PERMISSION_STEP.REQUEST_SYSTEM, () => (
      <PushPermissionNotice.RequestSystem className={className} onDismiss={dismiss} />
    ))
    .with(PUSH_PERMISSION_STEP.OPEN_SETTINGS, () => (
      <PushPermissionNotice.OpenSettings className={className} onDismiss={dismiss} />
    ))
    .with(PUSH_PERMISSION_STEP.ENABLE_IN_APP, () => (
      <PushPermissionNotice.EnableInApp className={className} onDismiss={dismiss} />
    ))
    .exhaustive();
}

interface StepNoticeProps {
  className?: string;
  onDismiss: () => void;
}

PushPermissionNotice.Ask = function Ask({ className, onDismiss }: StepNoticeProps) {
  const { t } = useTranslation('notification');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <InlineAlert
        className={className}
        image={null}
        title={t('permission.card.askTitle')}
        description={t('permission.card.askDescription')}
        action={
          <Button
            size="small"
            variant="weak"
            display="inline"
            onPress={() => setIsDialogOpen(true)}
          >
            {t('permission.card.continue')}
          </Button>
        }
        onClose={onDismiss}
        closeLabel={t('permission.card.dismiss')}
      />
      <PushPermissionDialog source={SOURCE} isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
};

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
          {t('permission.card.continue')}
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

PushPermissionNotice.EnableInApp = function EnableInApp({ className, onDismiss }: StepNoticeProps) {
  const { t } = useTranslation('notification');
  const navigate = useSingleTap(router.navigate);

  return (
    <InlineAlert
      className={className}
      image={null}
      title={t('permission.card.appOffTitle')}
      description={t('permission.card.appOffDescription')}
      action={
        <Button
          size="small"
          variant="weak"
          display="inline"
          onPress={() => navigate('/settings/notifications/push')}
        >
          {t('permission.card.turnOn')}
        </Button>
      }
      onClose={onDismiss}
      closeLabel={t('permission.card.dismiss')}
    />
  );
};
