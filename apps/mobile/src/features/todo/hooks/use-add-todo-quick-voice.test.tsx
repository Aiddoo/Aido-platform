import '@src/shared/i18n/init';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { EntitlementService } from '@src/features/subscription/apis/entitlement.service';
import { UserService } from '@src/features/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import { VoiceService } from '@src/features/voice/apis/voice.service';
import {
  createErrorReporterStub,
  createHapticsStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
  createMockStorage,
  createMockTokenStore,
  createSpeechRecognizerStub,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ApiError } from '@src/shared/errors/api-error';
import { err, ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider, Text } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable } from 'react-native';

import { TodoCategoryService } from '../apis/todo-category.service';
import type { AddTodoFormValues } from '../domains/add-todo-form.schema';
import { useAddTodoQuickVoice } from './use-add-todo-quick-voice';

// AuthService가 읽는 앱 설정(ENV)은 불러올 때 expo extra를 검사해서, 기존 인증 테스트처럼 설정 모듈만 대체한다
jest.mock('@src/shared/config/env', () => ({ ENV: { API_URL: 'http://localhost:3000' } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));

const ACCOUNT_ID = 'user-1';
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const createQuickPlanDto = (actions: unknown[], charged = true) => ({
  plan: { actions, omittedTodoCount: 0 },
  meta: {
    model: 'm',
    processingTimeMs: 1,
    tokenUsage: { input: 1, output: 1 },
    promptVersion: 'quick-plan@1',
  },
  featureQuota: null,
  charged,
});

const WORKOUT_ACTION = {
  type: 'CREATE_TODO',
  key: 'a1',
  title: '운동',
  startDate: '2026-11-09',
  endDate: null,
  scheduledTime: null,
  repeat: null,
  visibility: null,
  items: [],
  categoryId: 1,
  duplicateOfTodoId: null,
};

function QuickVoiceProbe({ onExit }: { onExit: () => void }) {
  const methods = useForm<AddTodoFormValues>({
    defaultValues: { title: '', startDate: new Date(2026, 10, 5), repeat: null },
  });
  const quickVoice = useAddTodoQuickVoice({ methods, onExit });
  const title = useWatch({ control: methods.control, name: 'title' });
  const { state } = quickVoice;

  return (
    <>
      <Pressable
        testID="begin"
        onPress={() => quickVoice.begin({ locale: 'ko-KR', contextualStrings: [] })}
      />
      <Pressable testID="finish" onPress={quickVoice.finish} />
      <Pressable testID="retry" onPress={quickVoice.retryPlanning} />
      <Pressable testID="type-instead" onPress={quickVoice.typeInstead} />
      <Pressable
        testID="continue-as-note"
        onPress={() => {
          quickVoice.continueAsVoiceNote().catch(jest.fn());
        }}
      />
      <Text testID="status">{state.status}</Text>
      <Text testID="title">{title}</Text>
      <Text testID="plan">
        {state.status === 'review'
          ? state.plan.actions.map((action) => action.title).join(',')
          : ''}
      </Text>
    </>
  );
}

async function renderQuickVoice() {
  const httpClient = createMockHttpClient();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();
  const voiceNoteStorage = createVoiceNoteStorageServiceFake();
  const onExit = jest.fn();
  const analytics = createMockAnalytics();
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: ACCOUNT_ID });

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <QuickVoiceProbe onExit={onExit} />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        voiceNoteStorageService: voiceNoteStorage,
        voiceService: new VoiceService(httpClient, logger),
        userService: new UserService(httpClient),
        todoCategoryService: new TodoCategoryService(httpClient),
        authService: new AuthService(httpClient, httpClient, createMockTokenStore()),
        entitlementService: new EntitlementService(httpClient, logger),
        coachmarkService: new CoachmarkService({ isSeen: () => true, markSeen: jest.fn() }),
        recognitionLanguageRepository:
          createRecognitionLanguageRepository(createMemorySyncStorage()),
        speechRecognizer,
        analytics,
        errorReporter: createErrorReporterStub(),
        haptics: createHapticsStub(),
        storage: createMockStorage(),
        logger,
      },
    },
  );

  return { httpClient, speechRecognizer, voiceNoteStorage, onExit, analytics };
}

async function speak(speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>) {
  await fireEvent.press(screen.getByTestId('begin'));
  await act(async () => speechRecognizer.emit({ type: 'start' }));
  await act(async () =>
    speechRecognizer.emit({ type: 'result', transcript: '말한 내용', isFinal: true, segments: [] }),
  );
  await fireEvent.press(screen.getByTestId('finish'));
  await act(async () => speechRecognizer.emit({ type: 'end' }));
}

const idempotencyKeyOf = (httpClient: ReturnType<typeof createMockHttpClient>, callIndex: number) =>
  httpClient.post.mock.calls[callIndex]?.[2]?.headers?.['Idempotency-Key'];

describe('useAddTodoQuickVoice', () => {
  it('말이 끝나면 글자를 계획 API로 보내고 같은 시트의 고르는 단계로 넘어간다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValue(ok(createQuickPlanDto([WORKOUT_ACTION])));

    // When
    await speak(speechRecognizer);

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(screen.getByTestId('plan')).toHaveTextContent('운동');
    expect(httpClient.post.mock.calls[0]?.[0]).toBe('v1/quick-plans');
    expect(httpClient.post.mock.calls[0]?.[1]).toEqual({ text: '말한 내용', source: 'VOICE' });
  });

  it('정리에 실패하면 들은 글자를 입력 칸에 남기고 다시 정리는 같은 키로 보낸다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1301', '실패', 503)));
    httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT_ACTION])));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));

    // When
    await fireEvent.press(screen.getByTestId('retry'));

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(screen.getByTestId('title')).toHaveTextContent('말한 내용');
    expect(idempotencyKeyOf(httpClient, 1)).toBe(idempotencyKeyOf(httpClient, 0));
  });

  it('결과 없음(AI_1317) 뒤의 사용자 재시도도 추가 차감이 없도록 같은 키를 쓴다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1317', '결과 없음', 410)));
    httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT_ACTION])));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));

    // When
    await fireEvent.press(screen.getByTestId('retry'));

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(idempotencyKeyOf(httpClient, 1)).toBe(idempotencyKeyOf(httpClient, 0));
  });

  it('내용이 다르다는 오류(AI_1318) 뒤에는 새 키로 보낸다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1318', '다른 내용', 422)));
    httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT_ACTION])));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));

    // When
    await fireEvent.press(screen.getByTestId('retry'));

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(idempotencyKeyOf(httpClient, 1)).not.toBe(idempotencyKeyOf(httpClient, 0));
  });

  it('찾은 할 일이 없으면 직접 입력을 고를 때 들은 글자를 입력 칸으로 옮긴다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValue(ok(createQuickPlanDto([], false)));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));

    // When
    await fireEvent.press(screen.getByTestId('type-instead'));

    // Then
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
    expect(screen.getByTestId('title')).toHaveTextContent('말한 내용');
  });

  describe('90초 제안', () => {
    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    async function listenUntilLimit(
      speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>,
    ) {
      await fireEvent.press(screen.getByTestId('begin'));
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      await act(async () =>
        speechRecognizer.emit({
          type: 'result',
          transcript: '길게 말한 내용.',
          isFinal: true,
          segments: [],
        }),
      );
      await act(async () => jest.advanceTimersByTime(90_100));
    }

    it('90초가 되면 자동으로 정리하지 않고 멈춰서 고르게 한다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderQuickVoice();

      // When
      await listenUntilLimit(speechRecognizer);

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('paused');
      expect(speechRecognizer.stop).toHaveBeenCalledTimes(1);
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('그대로 정리를 고르면 들은 글자로 계획을 만든다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderQuickVoice();
      httpClient.post.mockResolvedValue(ok(createQuickPlanDto([WORKOUT_ACTION])));
      await listenUntilLimit(speechRecognizer);

      // When
      await fireEvent.press(screen.getByTestId('finish'));

      // Then
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
      expect(httpClient.post.mock.calls[0]?.[1]).toEqual({
        text: '길게 말한 내용.',
        source: 'VOICE',
      });
    });

    it('말로 메모하기를 고르면 들은 글자를 초안에 저장하고 시트를 닫은 뒤 이어 듣기로 간다', async () => {
      // Given
      const { httpClient, speechRecognizer, voiceNoteStorage, onExit, analytics } =
        await renderQuickVoice();
      await listenUntilLimit(speechRecognizer);
      // 동의 상태를 읽지 못하면 묻지 않고 넘어간다
      httpClient.get.mockRejectedValue(new Error('offline'));

      // When
      await fireEvent.press(screen.getByTestId('continue-as-note'));

      // Then
      await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
      const [note] = voiceNoteStorage.drafts.findAll(ACCOUNT_ID);
      expect(note?.sentences.map(({ text }) => text)).toEqual(['길게 말한 내용.']);
      expect(onExit).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/voice-notes/record',
        params: { draftId: note?.draftId, entry: 'quick_voice_upgrade' },
      });
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'voice_capture_finished',
        expect.objectContaining({ mode: 'quick', outcome: 'upgraded' }),
      );
      expect(speechRecognizer.abort).toHaveBeenCalled();
    });

    it('마이크 권한을 거절하면 시트에 그대로 남아 글자를 잃지 않는다', async () => {
      // Given
      const { httpClient, speechRecognizer, voiceNoteStorage, onExit } = await renderQuickVoice();
      await listenUntilLimit(speechRecognizer);
      httpClient.get.mockRejectedValue(new Error('offline'));
      speechRecognizer.getPermission.mockResolvedValue({ isGranted: false, canAskAgain: true });
      speechRecognizer.requestPermission.mockResolvedValue({
        isGranted: false,
        canAskAgain: true,
      });

      // When
      await fireEvent.press(screen.getByTestId('continue-as-note'));
      await waitFor(() => expect(speechRecognizer.requestPermission).toHaveBeenCalled());

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('paused');
      expect(onExit).not.toHaveBeenCalled();
      expect(voiceNoteStorage.drafts.findAll(ACCOUNT_ID)).toEqual([]);
    });
  });
});
