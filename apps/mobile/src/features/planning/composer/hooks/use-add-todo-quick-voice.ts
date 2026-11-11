import {
  useIdGenerator,
  useLogger,
  useVoiceNoteDraftRepository,
} from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useClaimAiConsentRenewal } from '@src/features/device/coachmark/hooks/use-claim-ai-consent-renewal';
import { isAiDataSharingConsentRequiredError } from '@src/features/identity/consent/domains/consent.error';
import { useAiDataSharingConsentGate } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { VOICE_LOG_EVENT } from '@src/features/voice/constants/voice-log-events';
import {
  PlanRequestPolicy,
  type PreparedPlanRequest,
} from '@src/features/voice/domains/plan-request.model';
import type { CapturedPlan } from '@src/features/voice/domains/voice-capture.model';
import { VoiceNoteCaptionPolicy } from '@src/features/voice/domains/voice-note-caption.model';
import { VoiceTranscriptPolicy } from '@src/features/voice/domains/voice-transcript.model';
import { useEnsureMicrophonePermission } from '@src/features/voice/hooks/use-ensure-microphone-permission';
import { useReadSpeechContext } from '@src/features/voice/hooks/use-read-speech-context';
import { useRecognitionLanguage } from '@src/features/voice/hooks/use-recognition-language';
import { useStartVoiceNote } from '@src/features/voice/hooks/use-start-voice-note';
import { useVoiceCaptureSession } from '@src/features/voice/hooks/use-voice-capture-session';
import { useCreateQuickPlanMutationOptions } from '@src/features/voice/queries/voice.mutations';
import type { CreateQuickPlanInput } from '@src/features/voice/schemas/quick-plan-request.schema';
import { getNowInstant } from '@src/shared/date/clock';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Keyboard } from 'react-native';

import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';

interface UseAddTodoQuickVoiceOptions {
  form: UseFormReturn<AddTodoFormValues>;
  onExit: () => void;
}

export function useAddTodoQuickVoice({ form, onExit }: UseAddTodoQuickVoiceOptions) {
  const gate = useEntitlementGate('AI_PARSE', { surface: 'add_todo_sheet' });
  const claimRenewalPrompt = useClaimAiConsentRenewal();
  const aiConsent = useAiDataSharingConsentGate({ claimRenewalPrompt });
  const ensureMicrophonePermission = useEnsureMicrophonePermission();
  const getSpeechContext = useReadSpeechContext();
  const [locale, setLocale] = useRecognitionLanguage();
  const planRequest = useQuickPlanRequest({ aiConsent, onExit });
  const idGenerator = useIdGenerator();
  const voiceNoteDraftRepository = useVoiceNoteDraftRepository();
  const startVoiceNote = useStartVoiceNote();
  const pushRecordScreen = useSingleTap(router.push);
  const logger = useLogger();
  const toast = useAppToast();
  const { t } = useTranslation(['voice', 'ai']);
  const isUnmountedRef = useRef(false);
  /** 다시 말하기로 입력 칸이 잠깐 보이는 동안 키보드를 올리지 않는다 */
  const [isRestarting, setIsRestarting] = useState(false);
  /** 실패했을 때 입력 칸에 친 글자가 있어 들은 글자를 옮기지 않았다. 고쳐 쓰는 동안 안내가 바뀌지 않게 실패한 때의 판단을 둔다 */
  const [isTypedTextKept, setIsTypedTextKept] = useState(false);

  const session = useVoiceCaptureSession({
    entry: 'add_todo_sheet',
    onCaptured: planRequest.send,
    // 90초가 되면 멈추고 고르게 한다. 들은 글자로 바로 정리하거나 말로 메모하기로 이어 간다
    onLimitReached: noop,
    onFailed: (transcript) => {
      const title = form.getValues('title').trim();
      const heardText = VoiceTranscriptPolicy.getTranscriptText(transcript);
      setIsTypedTextKept(title.length > 0 && title !== heardText);
      if (title.length === 0) {
        form.setValue('title', heardText, { shouldDirty: true });
      }
    },
  });
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  const moveTranscriptToTitle = () => {
    form.setValue(
      'title',
      VoiceTranscriptPolicy.mergeHeardTextIntoTitle(
        session.state.transcript,
        form.getValues('title'),
      ),
      { shouldDirty: true },
    );
  };

  const start = async () => {
    const hasFailed = session.state.status === 'failed';
    if (gate.promptIfBlocked({ onSubscribe: onExit })) {
      return;
    }
    Keyboard.dismiss();
    const consent = await aiConsent.requestAgreementBeforeListening();
    if (!consent.hasAgreed) {
      toast.toast(t('ai:consent.notice.voice'));
    }
    if (!consent.hasAgreed || isUnmountedRef.current) {
      return;
    }
    planRequest.rememberConsentAsked(consent.wasAsked);
    const isGranted = await ensureMicrophonePermission('quick', locale);
    if (!isGranted || isUnmountedRef.current) {
      return;
    }
    // 실패한 세션에서 다시 누르면 처음부터 듣는다. 지우기 전에 들은 글자를 입력 칸에 옮겨 둔다
    if (hasFailed) {
      moveTranscriptToTitle();
      session.cancel();
    }
    await session.begin({ locale, hintWords: getSpeechContext() });
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

  /** 들은 글자를 기기 초안에 먼저 저장하고 녹음 화면에서 이어 듣는다. 다음 화면이 실패해도 글자는 메모 탭에 남는다 */
  const continueAsVoiceNote = () => {
    // 이어 갈 계정을 모르면 글자를 저장할 곳이 없어 말로 메모하기로 넘기지 않고 지금까지 들은 글자로 정리한다
    if (me == null) {
      session.finish();
      return Promise.resolve();
    }
    return startVoiceNote({
      onSubscribe: onExit,
      onReadyToRecord: () => {
        const { transcript, elapsedMs } = session.state;
        const note = VoiceNoteCaptionPolicy.createTranscribedVoiceNote({
          draftId: idGenerator.create(),
          locale,
          createdAt: getNowInstant(),
          transcript,
          durationMs: elapsedMs,
        });
        const hasHeardText = note.sentences.length > 0;
        if (hasHeardText) {
          voiceNoteDraftRepository.save(me.id, note);
        }
        session.handOff();
        onExit();
        pushRecordScreen({
          pathname: '/voice-notes/record',
          params: {
            draftId: hasHeardText ? note.draftId : undefined,
            entry: 'quick_voice_upgrade',
          },
        });
      },
    });
  };

  /** 언어마다 필요한 권한이 달라 허용된 뒤에만 바꾼다. 거절하면 듣던 언어로 이어 간다 */
  const changeLocale = (nextLocale: SpeechLocale) => {
    const applyLocale = async () => {
      if (await ensureMicrophonePermission('quick', nextLocale)) {
        setLocale(nextLocale);
        await session.changeLocale(nextLocale);
      }
    };

    applyLocale().catch((error: unknown) => {
      logger.warn(VOICE_LOG_EVENT.LANGUAGE_CHANGE_FAILED, { error: getErrorMessage(error) });
      toast.error(t('listening.languageChangeFailed'));
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
    continueAsVoiceNote,
  };
}

interface UseQuickPlanRequestOptions {
  aiConsent: ReturnType<typeof useAiDataSharingConsentGate>;
  onExit: () => void;
}

/** 들은 글자로 계획을 요청한다. 같은 글자의 재시도는 같은 키로 보내고, 동의가 막으면 한 번 묻고 이어서 보낸다 */
function useQuickPlanRequest({ aiConsent, onExit }: UseQuickPlanRequestOptions) {
  const idGenerator = useIdGenerator();
  const planMutation = useMutation(useCreateQuickPlanMutationOptions({ onSubscribe: onExit }));
  const hasAskedConsentRef = useRef(false);
  const [isConsentRequired, setIsConsentRequired] = useState(false);
  const planRequestRef = useRef<PreparedPlanRequest<CreateQuickPlanInput> | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => planAbortRef.current?.abort(), []);

  const send = async (text: string): Promise<CapturedPlan> => {
    const request = PlanRequestPolicy.preparePlanRequest<CreateQuickPlanInput>({
      previous: planRequestRef.current,
      input: { text, source: 'quick-voice' },
      createIdempotencyKey: idGenerator.create,
    });
    planRequestRef.current = request;
    setIsConsentRequired(false);
    const abortController = new AbortController();
    planAbortRef.current = abortController;

    try {
      const { plan, isCharged } = await planMutation.mutateAsync({
        ...request,
        signal: abortController.signal,
      });
      planRequestRef.current = null;
      return { plan, isCharged };
    } catch (error) {
      planRequestRef.current = PlanRequestPolicy.getRequestToRetry(request, error);
      if (isAiDataSharingConsentRequiredError(error) && !hasAskedConsentRef.current) {
        hasAskedConsentRef.current = true;
        if (await aiConsent.requestAgreement()) {
          return send(text);
        }
      }
      // 이번 시도는 끝났다. 앞에서 나중에를 눌렀어도 다시 정리하면 안내를 다시 본다
      hasAskedConsentRef.current = false;
      setIsConsentRequired(isAiDataSharingConsentRequiredError(error));
      throw error;
    }
  };

  return {
    send,
    isConsentRequired,
    rememberConsentAsked: (wasAsked: boolean) => {
      hasAskedConsentRef.current = wasAsked;
    },
    abort: () => planAbortRef.current?.abort(),
    forget: () => {
      planRequestRef.current = null;
    },
  };
}
