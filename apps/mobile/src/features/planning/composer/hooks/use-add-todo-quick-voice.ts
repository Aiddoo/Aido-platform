import { useLogger } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import { VOICE_LOG_EVENT } from '@src/features/voice/constants/voice-log-events';
import { QUICK_CAPTURE_MAX_SECONDS } from '@src/features/voice/constants/voice.constants';
import { VoiceTranscriptPolicy } from '@src/features/voice/domains/voice-transcript.model';
import { useContinueAsVoiceNote } from '@src/features/voice/hooks/use-continue-as-voice-note';
import { useEnsureMicrophonePermission } from '@src/features/voice/hooks/use-ensure-microphone-permission';
import { useQuickPlanRequest } from '@src/features/voice/hooks/use-quick-plan-request';
import { useReadSpeechContext } from '@src/features/voice/hooks/use-read-speech-context';
import { useRecognitionLanguage } from '@src/features/voice/hooks/use-recognition-language';
import { useVoiceCaptureReadiness } from '@src/features/voice/hooks/use-voice-capture-readiness';
import { useVoiceCaptureSession } from '@src/features/voice/hooks/use-voice-capture-session';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { useTranslation } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { noop } from 'es-toolkit';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

interface UseAddTodoQuickVoiceOptions {
  form: UseFormReturn<TodoFormValues>;
  onExit: () => void;
}

// 들은 글자를 잃지 않게 실패·취소·직접 입력 때 제목 칸으로 옮긴다
export function useAddTodoQuickVoice({ form, onExit }: UseAddTodoQuickVoiceOptions) {
  const ensureReady = useVoiceCaptureReadiness({
    feature: 'AI_PARSE',
    surface: 'add_todo_sheet',
    mode: 'quick',
  });
  const getSpeechContext = useReadSpeechContext();
  const planRequest = useQuickPlanRequest({ onSubscribe: onExit });
  const continueAsVoiceNote = useContinueAsVoiceNote();
  // 다시 말하기로 입력 칸이 잠깐 보이는 동안 키보드를 올리지 않는다
  const [isRestarting, setIsRestarting] = useState(false);
  // 실패 때 친 글자가 있어 들은 글자를 옮기지 않았는지. 고쳐 쓰는 동안 안내가 바뀌지 않게 그때 판단을 둔다
  const [isTypedTextKept, setIsTypedTextKept] = useState(false);

  const session = useVoiceCaptureSession({
    entry: 'add_todo_sheet',
    maxSeconds: QUICK_CAPTURE_MAX_SECONDS,
    onCaptured: planRequest.send,
    // 90초가 되면 멈추고 고르게 한다. 들은 글자로 바로 정리하거나 말로 메모하기로 이어 간다
    onLimitReached: noop,
    onFailed: (transcript) => {
      const title = form.getValues('title').trim();
      const heardText = VoiceTranscriptPolicy.getTranscriptText(transcript);
      setIsTypedTextKept(title.length > 0 && title !== heardText);
      if (title.length === 0) {
        form.setValue('title', heardText, { shouldDirty: true, shouldValidate: true });
      }
    },
  });
  const [locale, changeLocale] = useQuickVoiceLocale({ onChange: session.changeLocale });

  const moveTranscriptToTitle = () => {
    form.setValue(
      'title',
      VoiceTranscriptPolicy.mergeHeardTextIntoTitle(
        session.state.transcript,
        form.getValues('title'),
      ),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const start = async () => {
    const hasFailed = session.state.status === 'failed';
    const readiness = await ensureReady({ locale, entry: 'add_todo_sheet', onSubscribe: onExit });
    if (!readiness.isReady) {
      return;
    }
    planRequest.rememberConsentAsked(readiness.wasConsentAsked);
    // 실패한 세션에서 다시 누르면 처음부터 듣는다. 지우기 전에 들은 글자를 입력 칸에 옮겨 둔다
    if (hasFailed) {
      moveTranscriptToTitle();
      session.cancel();
    }
    await session.begin({ locale, hintWords: getSpeechContext(), recordingDirectory: null });
  };

  const restart = async () => {
    setIsRestarting(true);
    planRequest.forget();
    session.cancel();
    try {
      await start();
    } finally {
      setIsRestarting(false);
    }
  };

  /** 정리를 기다리다 그만둔다. 글자는 입력 칸에 남기고, 같은 글자를 다시 보내면 같은 키라 두 번 차감되지 않는다 */
  const cancelPlanning = () => {
    planRequest.abort();
    moveTranscriptToTitle();
    session.cancel();
  };

  const typeInstead = () => {
    moveTranscriptToTitle();
    planRequest.forget();
    session.cancel();
  };

  const continueAsNote = () => {
    if (continueAsVoiceNote == null) {
      session.finish();
      return Promise.resolve();
    }
    return continueAsVoiceNote({
      locale,
      heard: session.state,
      onHandOff: session.handOff,
      onExit,
    });
  };

  return {
    ...session,
    isConsentRequired: planRequest.isConsentRequired,
    isTypedTextKept,
    locale,
    changeLocale,
    start,
    restart,
    isRestarting,
    cancelPlanning,
    typeInstead,
    continueAsVoiceNote: continueAsNote,
  };
}

/** 언어마다 필요한 권한이 달라 허용된 뒤에만 바꾼다. 거절하면 듣던 언어로 이어 간다 */
function useQuickVoiceLocale({ onChange }: { onChange: (locale: SpeechLocale) => Promise<void> }) {
  const { t } = useTranslation('voice');
  const logger = useLogger();
  const toast = useAppToast();
  const [locale, setLocale] = useRecognitionLanguage();
  const ensureMicrophonePermission = useEnsureMicrophonePermission();

  const changeLocale = (nextLocale: SpeechLocale) => {
    const applyLocale = async () => {
      if (await ensureMicrophonePermission('quick', nextLocale)) {
        setLocale(nextLocale);
        await onChange(nextLocale);
      }
    };

    applyLocale().catch((error: unknown) => {
      logger.warn(VOICE_LOG_EVENT.LANGUAGE_CHANGE_FAILED, { error: getErrorMessage(error) });
      toast.error(t('listening.languageChangeFailed'));
    });
  };

  return [locale, changeLocale] as const;
}
