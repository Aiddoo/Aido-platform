import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/get-preference-query-options';
import { type PushPermissionPromptSource, useTrack } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Button, CloseIcon, HStack, ListRow } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CloseButton } from 'heroui-native';
import { type ReactNode, useEffect, useState } from 'react';
import { match } from 'ts-pattern';

import { PUSH_PERMISSION_STEP, PushPermissionPolicy } from '../domains/push-permission.model';
import { usePushPermissionPrompt } from '../hooks/use-push-permission-prompt';
import { useGetPushPermissionQueryOptions } from '../queries/get-push-permission-query-options';
import { useOpenPushSettingsMutationOptions } from '../queries/use-open-push-settings-mutation-options';
import { useRequestPushPermissionMutationOptions } from '../queries/use-request-push-permission-mutation-options';
import { PushPermissionDialog } from './push-permission-dialog';

const SOURCE: PushPermissionPromptSource = 'feed_card';

interface PushPermissionCardProps {
  className?: string;
}

/** 이 기기로 알림이 닿지 않을 때 다음 할 일을 알려 준다. 닫으면 14일 동안 숨긴다 */
export function PushPermissionCard({ className }: PushPermissionCardProps) {
  const [{ data: permission }, { data: preference }] = useSuspenseQueries({
    queries: [useGetPushPermissionQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const prompt = usePushPermissionPrompt();
  const { trackEvent } = useTrack();
  const step = PushPermissionPolicy.nextStep(permission, preference);
  const isVisible = !prompt.isSnoozed && step !== PUSH_PERMISSION_STEP.NONE;

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
    prompt.snooze();
  };

  return match(step)
    .with(PUSH_PERMISSION_STEP.ASK, () => (
      <PushPermissionCard.Ask className={className} onDismiss={dismiss} />
    ))
    .with(PUSH_PERMISSION_STEP.REQUEST_SYSTEM, () => (
      <PushPermissionCard.RequestSystem className={className} onDismiss={dismiss} />
    ))
    .with(PUSH_PERMISSION_STEP.OPEN_SETTINGS, () => (
      <PushPermissionCard.OpenSettings className={className} onDismiss={dismiss} />
    ))
    .with(PUSH_PERMISSION_STEP.ENABLE_IN_APP, () => (
      <PushPermissionCard.EnableInApp className={className} onDismiss={dismiss} />
    ))
    .exhaustive();
}

interface StepNoticeProps {
  className?: string;
  onDismiss: () => void;
}

PushPermissionCard.Ask = function Ask({ className, onDismiss }: StepNoticeProps) {
  const { t } = useTranslation('notification');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Notice
        className={className}
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
        onDismiss={onDismiss}
      />
      <PushPermissionDialog source={SOURCE} isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
};

PushPermissionCard.RequestSystem = function RequestSystem({
  className,
  onDismiss,
}: StepNoticeProps) {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const requestPermission = useMutation(useRequestPushPermissionMutationOptions());

  return (
    <Notice
      className={className}
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
      onDismiss={onDismiss}
    />
  );
};

PushPermissionCard.OpenSettings = function OpenSettings({ className, onDismiss }: StepNoticeProps) {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const openSettings = useMutation(useOpenPushSettingsMutationOptions());

  return (
    <Notice
      className={className}
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
      onDismiss={onDismiss}
    />
  );
};

PushPermissionCard.EnableInApp = function EnableInApp({ className, onDismiss }: StepNoticeProps) {
  const { t } = useTranslation('notification');
  const navigate = useSingleTap(router.navigate);

  return (
    <Notice
      className={className}
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
      onDismiss={onDismiss}
    />
  );
};

interface NoticeProps {
  className?: string;
  title: string;
  description: string;
  action: ReactNode;
  onDismiss: () => void;
}

function Notice({ className, title, description, action, onDismiss }: NoticeProps) {
  const { t } = useTranslation('notification');

  return (
    <ListRow
      className={cn('rounded-xl bg-gray-1', className)}
      horizontalPadding="medium"
      verticalPadding="large"
      contents={
        <ListRow.Texts
          type="2RowTypeA"
          top={title}
          topProps={{ size: 'b3', weight: 'medium' }}
          bottom={description}
          bottomProps={{ size: 'e1', shade: 6 }}
        />
      }
      right={
        <HStack align="center" gap={8}>
          {action}
          <CloseButton
            variant="ghost"
            className="size-5"
            onPress={onDismiss}
            accessibilityLabel={t('permission.card.dismiss')}
          >
            <CloseIcon width={20} height={20} colorClassName="text-gray-6" />
          </CloseButton>
        </HStack>
      }
    />
  );
}
