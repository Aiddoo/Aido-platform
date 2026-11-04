import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { isAiDataSharingConsentRequiredError } from '@src/features/ai/domains/ai.error';
import { useAiDataSharingConsentGate } from '@src/features/ai/hooks/use-ai-data-sharing-consent-gate';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import type { CreateQuickPlanInput } from '@src/features/voice/apis/voice.service';
import {
  PlanRequestPolicy,
  type PreparedPlanRequest,
} from '@src/features/voice/domains/plan-request.model';
import type { CapturedPlan } from '@src/features/voice/domains/voice-capture.model';
import { createVoiceNoteFromTranscript } from '@src/features/voice/domains/voice-note-caption.model';
import { getTranscriptText } from '@src/features/voice/domains/voice-transcript.model';
import { useMicrophonePermission } from '@src/features/voice/hooks/use-microphone-permission';
import { useRecognitionLanguage } from '@src/features/voice/hooks/use-recognition-language';
import { useSpeechContext } from '@src/features/voice/hooks/use-speech-context';
import { useVoiceCaptureSession } from '@src/features/voice/hooks/use-voice-capture-session';
import { useVoiceNoteStart } from '@src/features/voice/hooks/use-voice-note-start';
import { useCreateQuickPlanMutationOptions } from '@src/features/voice/queries/use-create-quick-plan-mutation-options';
import { voiceNoteRecordHref } from '@src/features/voice/utils/navigation/voice-note-href';
import { useMutation, useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Keyboard } from 'react-native';

import type { AddTodoFormValues } from '../domains/add-todo-form.schema';

interface UseAddTodoQuickVoiceOptions {
  methods: UseFormReturn<AddTodoFormValues>;
  /** 구독 화면으로 가기 직전에 시트를 닫는다 */
  onExit: () => void;
}

/**
 * 할 일 추가 시트의 말로 할 일 만들기. 한도 확인 → AI 동의 → 마이크 권한 → 듣기 순서로 시작하고,
 * 듣기가 끝나면 글자를 계획 API로 보내 같은 시트 안에서 고르는 단계(`review`)로 넘어간다.
 * 실패하면 들은 글자를 입력 칸에 남기고, 다시 정리할 때 같은 키를 써서 두 번 차감되지 않는다.
 */
export function useAddTodoQuickVoice({ methods, onExit }: UseAddTodoQuickVoiceOptions) {
  const gate = useEntitlementGate('AI_PARSE', { surface: 'add_todo_sheet' });
  const aiConsent = useAiDataSharingConsentGate();
  const ensureMicrophonePermission = useMicrophonePermission();
  const getSpeechContext = useSpeechContext();
  const [locale, setLocale] = useRecognitionLanguage();
  const planMutation = useMutation(useCreateQuickPlanMutationOptions({ onSubscribe: onExit }));
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });
  const hasAskedConsentRef = useRef(false);
  const [isConsentRequired, setIsConsentRequired] = useState(false);
  const planRequestRef = useRef<PreparedPlanRequest<CreateQuickPlanInput> | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);
  const voiceNoteStorage = useVoiceNoteStorageService();
  const startVoiceNote = useVoiceNoteStart();
  /** 다시 말하기로 입력 칸이 잠깐 보이는 동안 키보드를 올리지 않는다 */
  const [isRestarting, setIsRestarting] = useState(false);

  const onCaptured = async (text: string): Promise<CapturedPlan> => {
    const request = PlanRequestPolicy.prepare<CreateQuickPlanInput>({
      previous: planRequestRef.current,
      input: { text, source: 'voice' },
      createIdempotencyKey: randomUUID,
    });
    planRequestRef.current = request;
    setIsConsentRequired(false);
    const abortController = new AbortController();
    planAbortRef.current = abortController;

    try {
      const { plan, charged } = await planMutation.mutateAsync({
        ...request,
        signal: abortController.signal,
      });
      planRequestRef.current = null;
      return { plan, isCharged: charged };
    } catch (error) {
      planRequestRef.current = PlanRequestPolicy.getAfterFailure(request, error);
      if (isAiDataSharingConsentRequiredError(error) && !hasAskedConsentRef.current) {
        hasAskedConsentRef.current = true;
        if (await aiConsent.requestAgreement()) {
          return onCaptured(text);
        }
      }
      // 이번 시도는 끝났다. 앞에서 나중에를 눌렀어도 다시 정리하면 안내를 다시 본다
      hasAskedConsentRef.current = false;
      setIsConsentRequired(isAiDataSharingConsentRequiredError(error));
      throw error;
    }
  };

  const session = useVoiceCaptureSession({
    entry: 'add_todo_sheet',
    onCaptured,
    // 90초가 되면 멈추고 고르게 한다. 들은 글자로 바로 정리하거나 말로 메모하기로 이어 간다
    onLimitReached: noop,
  });

  useEffect(() => () => planAbortRef.current?.abort(), []);

  const failedStatus = session.state.status === 'failed';
  useEffect(() => {
    if (failedStatus && methods.getValues('title').trim().length === 0) {
      methods.setValue('title', getTranscriptText(session.state.transcript), { shouldDirty: true });
    }
  }, [failedStatus, methods, session.state.transcript]);

  const start = async () => {
    const hasFailed = session.state.status === 'failed';
    if (!gate.guard({ onSubscribe: onExit })) {
      return;
    }
    Keyboard.dismiss();
    const consent = await aiConsent.ensureAgreedOnce();
    hasAskedConsentRef.current = consent.wasAsked;
    if (!(await ensureMicrophonePermission('quick', locale))) {
      return;
    }
    // 실패한 세션에서 다시 누르면 처음부터 듣는다. 들은 글자는 이미 입력 칸에 옮겨 뒀다
    if (hasFailed) {
      session.cancel();
    }
    await session.begin({ locale, contextualStrings: getSpeechContext() });
  };

  /** 고른 카드를 버리고 처음부터 다시 듣는다 */
  const restart = async () => {
    setIsRestarting(true);
    planRequestRef.current = null;
    session.cancel();
    try {
      await start();
    } finally {
      setIsRestarting(false);
    }
  };

  const moveTranscriptToTitle = () => {
    methods.setValue('title', getTranscriptText(session.state.transcript), { shouldDirty: true });
  };

  /** 정리를 기다리다 그만둔다. 글자는 입력 칸에 남기고, 같은 글자를 다시 보내면 같은 키라 두 번 차감되지 않는다 */
  const cancelPlanning = () => {
    planAbortRef.current?.abort();
    moveTranscriptToTitle();
    session.cancel();
  };

  /** 계획에 할 일이 없을 때 들은 글자를 입력 칸에 옮겨 직접 고치게 한다 */
  const typeInstead = () => {
    moveTranscriptToTitle();
    planRequestRef.current = null;
    session.cancel();
  };

  /** 들은 글자를 기기 초안에 먼저 저장하고 녹음 화면에서 이어 듣는다. 다음 화면이 실패해도 글자는 메모 탭에 남는다 */
  const continueAsVoiceNote = () => {
    if (me == null) {
      session.finish();
      return Promise.resolve();
    }
    return startVoiceNote({
      onSubscribe: onExit,
      getRecordHref: () => {
        const { transcript, elapsedMs } = session.state;
        const note = createVoiceNoteFromTranscript({
          draftId: randomUUID(),
          locale,
          createdAt: new Date(),
          transcript,
          durationMs: elapsedMs,
        });
        if (note.sentences.length > 0) {
          voiceNoteStorage.drafts.save(me.id, note);
        }
        session.handOff();
        onExit();
        return voiceNoteRecordHref({
          draftId: note.sentences.length > 0 ? note.draftId : undefined,
          entry: 'quick_voice_upgrade',
        });
      },
    });
  };

  /** 언어마다 필요한 권한이 달라 허용된 뒤에만 바꾼다. 거절하면 듣던 언어로 이어 간다 */
  const applyLocale = async (nextLocale: SpeechLocale) => {
    if (await ensureMicrophonePermission('quick', nextLocale)) {
      setLocale(nextLocale);
      await session.changeLocale(nextLocale);
    }
  };

  const changeLocale = (nextLocale: SpeechLocale) => {
    applyLocale(nextLocale).catch(noop);
  };

  return {
    ...session,
    isConsentRequired,
    locale,
    setLocale: changeLocale,
    start,
    restart,
    isRestarting,
    cancelPlanning,
    typeInstead,
    continueAsVoiceNote,
  };
}
