import { isAiDataSharingConsentRequiredError } from '@src/features/ai/domains/ai.error';
import type { ParsedTodo } from '@src/features/ai/domains/parsed-todo.model';
import { useAiDataSharingConsentGate } from '@src/features/ai/hooks/use-ai-data-sharing-consent-gate';
import { useParseTodoMutationOptions } from '@src/features/ai/queries/use-parse-todo-mutation-options';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { getTranscriptText } from '@src/features/voice/domains/voice-transcript.model';
import { useMicrophonePermission } from '@src/features/voice/hooks/use-microphone-permission';
import { useRecognitionLanguage } from '@src/features/voice/hooks/use-recognition-language';
import { useSpeechContext } from '@src/features/voice/hooks/use-speech-context';
import { useVoiceCaptureSession } from '@src/features/voice/hooks/use-voice-capture-session';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Keyboard } from 'react-native';

import type { AddTodoFormValues } from '../domains/add-todo-form.schema';
import { type TodoRepeat, TodoRepeatPolicy } from '../domains/todo-repeat.model';

interface UseAddTodoQuickVoiceOptions {
  methods: UseFormReturn<AddTodoFormValues>;
  /** 구독 화면으로 가기 직전에 시트를 닫는다 */
  onExit: () => void;
}

function toParsedTodoRepeat({ isRecurring, recurrence }: ParsedTodo): TodoRepeat | null {
  return isRecurring && recurrence != null
    ? TodoRepeatPolicy.createWeeklyUntil(recurrence.daysOfWeek, toDeviceDateKey(recurrence.endDate))
    : null;
}

/**
 * 할 일 추가 시트의 말로 할 일 만들기. 한도 확인 → AI 동의 → 마이크 권한 → 듣기 순서로 시작하고,
 * 듣기가 끝나면 글자를 기존 parse-todo로 보내 폼을 채운다.
 * 글자를 할 일로 바꾸는 쪽은 아래 `onCaptured` 한 곳이라 계획 카드로 바꿀 때 여기만 갈아 끼운다.
 */
export function useAddTodoQuickVoice({ methods, onExit }: UseAddTodoQuickVoiceOptions) {
  const gate = useEntitlementGate('AI_PARSE', { surface: 'add_todo_sheet' });
  const aiConsent = useAiDataSharingConsentGate();
  const ensureMicrophonePermission = useMicrophonePermission();
  const getSpeechContext = useSpeechContext();
  const [locale, setLocale] = useRecognitionLanguage();
  const parseMutation = useMutation(useParseTodoMutationOptions());
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });
  const hasAskedConsentRef = useRef(false);

  const applyParsedTodo = (
    parsedTodo: Awaited<ReturnType<typeof parseMutation.mutateAsync>>['data'],
  ) => {
    const parsedTodoRepeat = toParsedTodoRepeat(parsedTodo);
    methods.reset(
      (previous) => ({
        ...previous,
        title: parsedTodo.title,
        startDate: parsedTodo.startDate,
        endDate: parsedTodoRepeat == null ? parsedTodo.endDate : null,
        scheduledTime: parsedTodo.scheduledTime,
        isAllDay: parsedTodo.scheduledTime ? false : parsedTodo.isAllDay,
        repeat: parsedTodoRepeat,
        source: 'ai',
      }),
      { keepDirtyValues: true },
    );
  };

  const onCaptured = async (text: string): Promise<void> => {
    try {
      const result = await parseMutation.mutateAsync({
        text,
        categoryId: methods.getValues('categoryId'),
      });
      applyParsedTodo(result.data);
    } catch (error) {
      if (isAiDataSharingConsentRequiredError(error) && !hasAskedConsentRef.current) {
        hasAskedConsentRef.current = true;
        if (await aiConsent.requestAgreement()) {
          return onCaptured(text);
        }
      }
      throw error;
    }
  };

  const session = useVoiceCaptureSession({ entry: 'add_todo_sheet', onCaptured });

  const failedStatus = session.state.status === 'failed';
  useEffect(() => {
    if (failedStatus && methods.getValues('title').trim().length === 0) {
      methods.setValue('title', getTranscriptText(session.state.transcript), { shouldDirty: true });
    }
  }, [failedStatus, methods, session.state.transcript]);

  const start = async () => {
    if (!gate.guard({ onSubscribe: onExit })) {
      return;
    }
    Keyboard.dismiss();
    const consent = me == null ? null : await aiConsent.ensureAgreedOnce(me.id);
    hasAskedConsentRef.current = consent?.wasAsked ?? false;
    if (!(await ensureMicrophonePermission('quick'))) {
      return;
    }
    await session.begin({ locale, contextualStrings: getSpeechContext() });
  };

  return { ...session, locale, setLocale, start };
}
