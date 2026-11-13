import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { t } from '@src/shared/i18n';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { useConfirmDialog } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui';

import type { VoiceCaptureEntry } from '../constants/voice.events';
import { offlineModelDeclinedStoredValue } from '../schemas/offline-model-declined-storage.schema';
import { useVoiceCaptureTelemetry } from './use-voice-capture-telemetry';

interface UseOfferOnDeviceModelOptions {
  accountId: string;
  entry: Extract<VoiceCaptureEntry, 'memo_tab' | 'quick_voice_upgrade'>;
}

interface OfferOnDeviceModelOptions {
  /** 확인을 기다리는 사이 녹음을 그만뒀다. 그 뒤로는 묻지도 받지도 않는다 */
  isAbandoned: () => boolean;
}

/** Android에 언어 모델이 없으면 한 번만 묻는다. 거절·시스템 창 취소·받을 수 없음이면 다시 묻지 않는다 */
export function useOfferOnDeviceModel({ accountId, entry }: UseOfferOnDeviceModelOptions) {
  const speechRecognizer = useSpeechRecognizer();
  // 계정 범위 저장소라 로그아웃 때 지워지고, 읽지 못하면 한 번 더 묻는다
  const storage = useStoredValueStorage(offlineModelDeclinedStoredValue);
  const confirmDialog = useConfirmDialog();
  const toast = useAppToast();
  const telemetry = useVoiceCaptureTelemetry({ entry, mode: 'note' });

  return async (locale: SpeechLocale, { isAbandoned }: OfferOnDeviceModelOptions) => {
    const { canDownloadOnDeviceModel } = await speechRecognizer.getCapabilities('note', locale);
    if (isAbandoned()) {
      return;
    }
    const scope = { accountId, locale };
    if (
      !canDownloadOnDeviceModel ||
      readStoredValue(storage, offlineModelDeclinedStoredValue, scope) != null
    ) {
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
      writeStoredValue(storage, offlineModelDeclinedStoredValue, 'declined', scope);
      telemetry.offlineModelDeclined(locale);
      return;
    }
    const result = await speechRecognizer.requestOfflineModel(locale);
    if (result !== 'downloaded') {
      writeStoredValue(storage, offlineModelDeclinedStoredValue, 'declined', scope);
    }
    telemetry.offlineModelRequested(locale, result);
    if (result === 'scheduled') {
      toast.toast(t('voiceNote:offlineModel.scheduled'));
    }
  };
}
