import { type PushPermissionPromptSource, useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { type ComponentProps, useEffect } from 'react';

import { PUSH_PERMISSION_STEP } from '../domains/push-permission.model';
import { useRequestPushPermissionMutationOptions } from '../queries/notification.mutations';

interface PushPermissionDialogProps extends Omit<
  ComponentProps<typeof ConfirmDialog>,
  'title' | 'description' | 'cancelButton' | 'confirmButton' | 'secondaryButton'
> {
  source: PushPermissionPromptSource;
}

/** 시스템 권한 창을 한 번만 띄울 수 있는 iOS에 맞춰, 먼저 앱 안에서 알림을 받을지 묻는다 */
export function PushPermissionDialog({
  source,
  onOpenChange,
  ...props
}: PushPermissionDialogProps) {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const requestPermission = useMutation(useRequestPushPermissionMutationOptions());

  useEffect(() => {
    if (props.isOpen) {
      trackEvent('push_permission_prompt_shown', { source, step: PUSH_PERMISSION_STEP.ASK });
    }
  }, [props.isOpen, source, trackEvent]);

  const later = () => {
    trackEvent('push_permission_prompt_dismissed', { source, step: PUSH_PERMISSION_STEP.ASK });
    onOpenChange(false);
  };

  const allow = () => {
    requestPermission.mutate(undefined, {
      onSuccess: (permission) => {
        trackEvent('push_permission_requested', { source, status: permission.status });
      },
      onSettled: () => onOpenChange(false),
    });
  };

  return (
    <ConfirmDialog
      {...props}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>{t('permission.dialog.title')}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>{t('permission.dialog.description')}</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={later}>
          {t('permission.dialog.later')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          testID="push-permission-continue"
          isLoading={requestPermission.isPending}
          onPress={allow}
        >
          {t('permission.dialog.continue')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}
