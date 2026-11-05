import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type {
  MissingSpeechPermission,
  SpeechLocale,
  SpeechMode,
} from '@src/core/ports/speech-recognizer';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import * as Linking from 'expo-linking';
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

/**
 * 그 언어로 듣는 데 필요한 마이크·음성 인식 권한을 확인하고 필요하면 묻는다. 허용되면 true다.
 * 다시 물을 수 없게 막혔으면 설정으로 안내하고, 이번만 거절했으면 토스트로 알린다. 문구는 실제로 막은 권한을 말한다.
 */
export function useMicrophonePermission() {
  const speechRecognizer = useSpeechRecognizer();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();

  return useCallback(
    async (mode: SpeechMode, locale: SpeechLocale) => {
      const current = await speechRecognizer.getPermission(mode, locale);
      const permission =
        current.isGranted || !current.canAskAgain
          ? current
          : await speechRecognizer.requestPermission(mode, locale);

      if (permission.isGranted) {
        return true;
      }
      const copy = getPermissionCopy(permission.missing);
      if (permission.canAskAgain) {
        toast.error(copy.denied);
        return false;
      }
      const shouldOpenSettings = await confirmDialog.open({
        title: copy.title,
        description: copy.message,
        cancelLabel: t('common:permissions.cancel'),
        confirmLabel: t('common:permissions.openSettings'),
      });
      if (shouldOpenSettings) {
        await Linking.openSettings();
      }
      return false;
    },
    [speechRecognizer, toast, confirmDialog],
  );
}
