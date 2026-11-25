import { useLogger } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { VOICE_LOG_EVENT } from '@src/features/voice/constants/voice-log-events';
import { QUICK_CAPTURE_MAX_SECONDS } from '@src/features/voice/constants/voice.constants';
import { VoiceTranscriptPolicy } from '@src/features/voice/domains/voice-transcript.model';
import { useContinueAsVoiceNote } from '@src/features/voice/hooks/use-continue-as-voice-note';
import { useEnsureMicrophonePermission } from '@src/features/voice/hooks/use-ensure-microphone-permission';
import { useQuickPlanRequest } from '@src/features/voice/hooks/use-quick-plan-request';
import { useReadSpeechContext } from '@src/features/voice/hooks/use-read-speech-context';
import { useRecognitionLanguage } from '@src/features/voice/hooks/use-recognition-language';
import { useVoiceCaptureReadiness } from '@src/features/voice/hooks/use-voice-capture-readiness';
import {
  useVoiceCaptureSession,
  type VoiceCapture,
  type VoiceCaptureControls,
} from '@src/features/voice/hooks/use-voice-capture-session';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { useTranslation } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { useState } from 'react';

interface UseAddTodoQuickVoiceOptions {
  /** 지금 제목 칸의 글자. 들은 글자를 옮길 때 읽는다 */
  getTitle: () => string;
  /** 들은 글자를 제목 칸에 넣는다. 고친 칸으로 만들고 다시 검사하는 일은 폼을 가진 시트가 한다 */
  onTitleChange: (title: string) => void;
  onExit: () => void;
}

interface AddTodoQuickVoice extends VoiceCapture {
  locale: SpeechLocale;
  isConsentRequired: boolean;
  /** 실패 때 친 글자가 있어 들은 글자를 옮기지 않았다 */
  isTypedTextKept: boolean;
  /** 다시 말하기로 입력 칸이 잠깐 보이는 동안이다. 키보드를 올리지 않는다 */
  isRestarting: boolean;
}

interface AddTodoQuickVoiceControls extends Pick<
  VoiceCaptureControls,
  'begin' | 'finish' | 'cancel' | 'resume' | 'interrupt' | 'retryPlanning'
> {
  /** 한도·동의·마이크를 거쳐 듣기 시작한다 */
  start: () => Promise<void>;
  restart: () => Promise<void>;
  cancelPlanning: () => void;
  typeInstead: () => void;
  changeLocale: (locale: SpeechLocale) => void;
  continueAsVoiceNote: () => Promise<void>;
}

// 들은 글자를 잃지 않게 실패·취소·직접 입력 때 제목 칸으로 옮긴다
export function useAddTodoQuickVoice({
  getTitle,
  onTitleChange,
  onExit,
}: UseAddTodoQuickVoiceOptions) {
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

  const [capture, session] = useVoiceCaptureSession({
    entry: 'add_todo_sheet',
    maxSeconds: QUICK_CAPTURE_MAX_SECONDS,
    onCaptured: planRequest.send,
    // 90초가 되면 멈추고 고르게 한다. 들은 글자로 바로 정리하거나 말로 메모하기로 이어 간다
    onLimitReached: noop,
    onFailed: (transcript) => {
      const title = getTitle().trim();
      const heardText = VoiceTranscriptPolicy.getTranscriptText(transcript);
      setIsTypedTextKept(title.length > 0 && title !== heardText);
      if (title.length === 0) {
        onTitleChange(heardText);
      }
    },
  });
  const [locale, changeLocale] = useQuickVoiceLocale({ onChange: session.changeLocale });

  const moveTranscriptToTitle = () => {
    onTitleChange(
      VoiceTranscriptPolicy.mergeHeardTextIntoTitle(capture.state.transcript, getTitle()),
    );
  };

  const start = async () => {
    const hasFailed = capture.state.status === 'failed';
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
    await start().finally(() => setIsRestarting(false));
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
      heard: capture.state,
      onHandOff: session.handOff,
      onExit,
    });
  };

  const quickVoice: AddTodoQuickVoice = {
    ...capture,
    locale,
    isConsentRequired: planRequest.isConsentRequired,
    isTypedTextKept,
    isRestarting,
  };
  const controls: AddTodoQuickVoiceControls = {
    begin: session.begin,
    finish: session.finish,
    cancel: session.cancel,
    resume: session.resume,
    interrupt: session.interrupt,
    retryPlanning: session.retryPlanning,
    start,
    restart,
    cancelPlanning,
    typeInstead,
    changeLocale,
    continueAsVoiceNote: continueAsNote,
  };

  return [quickVoice, controls] as const;
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
