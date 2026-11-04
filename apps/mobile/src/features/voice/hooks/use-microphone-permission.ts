import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type { SpeechMode } from '@src/core/ports/speech-recognizer';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import * as Linking from 'expo-linking';
import { useCallback } from 'react';

/**
 * 마이크·음성 인식 권한을 확인하고 필요하면 묻는다. 허용되면 true다.
 * 다시 물을 수 없게 막혔으면 설정으로 안내하고, 이번만 거절했으면 토스트로 알린다.
 */
export function useMicrophonePermission() {
  const speechRecognizer = useSpeechRecognizer();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();

  return useCallback(
    async (mode: SpeechMode) => {
      const current = await speechRecognizer.getPermission(mode);
      const permission =
        current.isGranted || !current.canAskAgain
          ? current
          : await speechRecognizer.requestPermission(mode);

      if (permission.isGranted) {
        return true;
      }
      if (permission.canAskAgain) {
        toast.error(t('common:permissions.microphone.denied'));
        return false;
      }
      const shouldOpenSettings = await confirmDialog.open({
        title: t('common:permissions.microphone.title'),
        description: t('common:permissions.microphone.message'),
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
