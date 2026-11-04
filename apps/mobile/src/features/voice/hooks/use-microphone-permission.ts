import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type { SpeechMode } from '@src/core/ports/speech-recognizer';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import * as Linking from 'expo-linking';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { match } from 'ts-pattern';

function showPermissionDeniedAlert() {
  Alert.alert(
    t('common:permissions.microphone.title'),
    t('common:permissions.microphone.message'),
    [
      { text: t('common:permissions.cancel'), style: 'cancel' },
      { text: t('common:permissions.openSettings'), onPress: () => Linking.openSettings() },
    ],
  );
}

/**
 * 마이크·음성 인식 권한을 확인하고 필요하면 묻는다. 허용되면 true다.
 * 다시 물을 수 없게 막혔으면 설정으로 안내하고, 이번만 거절했으면 토스트로 알린다.
 */
export function useMicrophonePermission() {
  const speechRecognizer = useSpeechRecognizer();
  const toast = useAppToast();

  return useCallback(
    async (mode: SpeechMode) => {
      const current = await speechRecognizer.getPermission(mode);
      const permission =
        current.isGranted || !current.canAskAgain
          ? current
          : await speechRecognizer.requestPermission(mode);

      return match(permission)
        .with({ isGranted: true }, () => true)
        .with({ canAskAgain: false }, () => {
          showPermissionDeniedAlert();
          return false;
        })
        .otherwise(() => {
          toast.error(t('common:permissions.microphone.denied'));
          return false;
        });
    },
    [speechRecognizer, toast],
  );
}
