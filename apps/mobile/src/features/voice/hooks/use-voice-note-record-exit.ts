import { useLogger } from '@src/bootstrap/providers/di-context';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { useAndroidBackHandler } from '@src/shared/hooks/use-android-back-handler';
import { useTranslation } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { router } from 'expo-router';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import { VoiceCapturePolicy } from '../domains/voice-capture.model';
import type { useVoiceNoteRecording } from './use-voice-note-recording';

/** 닫기·끝내기·Android 뒤로 가기. 들은 글자가 있으면 묻고, 실패는 다시 누르면 되니 진단만 남긴다 */
export function useVoiceNoteRecordExit({
  state,
  hasText,
  discard,
  finish,
}: Pick<ReturnType<typeof useVoiceNoteRecording>, 'state' | 'hasText' | 'discard' | 'finish'>) {
  const { t } = useTranslation('voiceNote');
  const logger = useLogger();
  const confirmDialog = useConfirmDialog();

  const handleClose = async () => {
    if (VoiceCapturePolicy.isWrappingUp(state)) {
      return;
    }
    if (!hasText) {
      discard();
      router.back();
      return;
    }
    // 듣기를 시작하기 전이면 끝낼 것이 없다. 넘겨받은 글자는 메모 탭의 초안에 그대로 있다
    if (state.status === 'idle') {
      router.back();
      return;
    }
    const shouldFinish = await confirmDialog.openAsync({
      title: t('record.leaveTitle'),
      description: t('record.leaveDescription'),
      confirmLabel: t('record.leaveConfirm'),
      cancelLabel: t('record.leaveCancel'),
    });
    if (shouldFinish) {
      finish();
    }
  };

  const handleFinishPress = async () => {
    if (VoiceCapturePolicy.canFinish(state)) {
      finish();
      return;
    }
    const shouldFinish = await confirmDialog.openAsync({
      title: t('record.finishEmptyTitle'),
      description: t('record.finishEmptyDescription'),
      confirmLabel: t('record.leaveConfirm'),
      cancelLabel: t('record.leaveCancel'),
    });
    if (shouldFinish) {
      finish();
    }
  };

  const logActionFailure = (action: 'close' | 'finish') => (error: unknown) => {
    logger.warn(VOICE_LOG_EVENT.RECORD_ACTION_FAILED, {
      action,
      error: getErrorMessage(error),
    });
  };
  const requestClose = () => {
    handleClose().catch(logActionFailure('close'));
  };
  const requestFinish = () => {
    handleFinishPress().catch(logActionFailure('finish'));
  };

  useAndroidBackHandler({
    onBack: () => {
      requestClose();
      return true;
    },
  });

  return { requestClose, requestFinish };
}
