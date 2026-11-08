import {
  useOfflineModelPromptRepository,
  useSpeechRecognizer,
} from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { t } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';

import type { VoiceCaptureEntry } from '../constants/voice.events';
import { useVoiceCaptureTelemetry } from './use-voice-capture-telemetry';

interface UseOfferOnDeviceModelOptions {
  accountId: string;
  entry: Extract<VoiceCaptureEntry, 'memo_tab' | 'quick_voice_upgrade'>;
}

interface OfferOnDeviceModelOptions {
  /** 확인을 기다리는 사이 녹음을 그만뒀다. 그 뒤로는 묻지도 받지도 않는다 */
  isAbandoned: () => boolean;
}

/**
 * Android에 이 언어 모델이 없으면 받을지 한 번만 묻는다. 거절하거나 시스템 창에서 취소했거나(결과를 알려주지 않는다)
 * 받을 수 없으면 그 언어는 다시 묻지 않고 네트워크 인식으로 이어 간다.
 */
export function useOfferOnDeviceModel({ accountId, entry }: UseOfferOnDeviceModelOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const offlineModelPrompt = useOfflineModelPromptRepository();
  const confirmDialog = useConfirmDialog();
  const toast = useAppToast();
  const telemetry = useVoiceCaptureTelemetry({ entry, mode: 'note' });

  return async (locale: SpeechLocale, { isAbandoned }: OfferOnDeviceModelOptions) => {
    const { canDownloadOnDeviceModel } = await speechRecognizer.getCapabilities('note', locale);
    if (isAbandoned()) {
      return;
    }
    if (!canDownloadOnDeviceModel || offlineModelPrompt.hasDeclined(accountId, locale)) {
      return;
    }
    const shouldDownload = await confirmDialog.openAsync({
      title: t('voiceNote:offlineModel.title'),
      description: t('voiceNote:offlineModel.description'),
      confirmLabel: t('voiceNote:offlineModel.confirm'),
      cancelLabel: t('voiceNote:offlineModel.cancel'),
    });
    if (isAbandoned()) {
      return;
    }
    if (!shouldDownload) {
      offlineModelPrompt.saveDeclined(accountId, locale);
      telemetry.offlineModelDeclined(locale);
      return;
    }
    const result = await speechRecognizer.requestOfflineModel(locale);
    if (result !== 'downloaded') {
      offlineModelPrompt.saveDeclined(accountId, locale);
    }
    telemetry.offlineModelRequested(locale, result);
    if (result === 'scheduled') {
      toast.toast(t('voiceNote:offlineModel.scheduled'));
    }
  };
}
