import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type {
  MissingSpeechPermission,
  SpeechLocale,
  SpeechMode,
} from '@src/core/ports/speech-recognizer';
import { useTrack } from '@src/shared/analytics';
import { useOpenAppSettings } from '@src/shared/hooks/use-open-app-settings';
import { t } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

function getPermissionCopy(missing: MissingSpeechPermission) {
  return match(missing)
    .with('microphone', () => ({
      title: t('common:permissions.microphone.title'),
      message: t('common:permissions.microphone.message'),
      denied: t('common:permissions.microphone.denied'),
    }))
    .with('speech-recognition', () => ({
      title: t('common:permissions.speechRecognition.title'),
      message: t('common:permissions.speechRecognition.message'),
      denied: t('common:permissions.speechRecognition.denied'),
    }))
    .with('both', () => ({
      title: t('common:permissions.microphoneAndSpeechRecognition.title'),
      message: t('common:permissions.microphoneAndSpeechRecognition.message'),
      denied: t('common:permissions.microphoneAndSpeechRecognition.denied'),
    }))
    .exhaustive();
}

export function useEnsureMicrophonePermission() {
  const speechRecognizer = useSpeechRecognizer();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const openAppSettings = useOpenAppSettings();

  return useCallback(
    async (mode: SpeechMode, locale: SpeechLocale) => {
      const current = await speechRecognizer.getPermission(mode, locale);
      const shouldRequest = current.status !== 'granted' && current.canAskAgain;
      const permission = shouldRequest
        ? await speechRecognizer.requestPermission(mode, locale)
        : current;
      // 받아쓰기는 음성 이벤트를 보내지 않는다
      if (shouldRequest && mode !== 'dictation') {
        trackEvent('voice_permission_requested', {
          mode,
          status: permission.status === 'granted' ? 'granted' : 'denied',
        });
      }

      if (permission.status === 'granted') {
        return true;
      }
      const copy = getPermissionCopy(permission.missing);
      if (permission.canAskAgain) {
        toast.error(copy.denied);
        return false;
      }
      const shouldOpenSettings = await confirmDialog.openAsync({
        title: copy.title,
        description: copy.message,
        cancelLabel: t('common:permissions.cancel'),
        confirmLabel: t('common:permissions.openSettings'),
      });
      if (shouldOpenSettings) {
        await openAppSettings();
      }
      return false;
    },
    [speechRecognizer, trackEvent, toast, confirmDialog, openAppSettings],
  );
}
