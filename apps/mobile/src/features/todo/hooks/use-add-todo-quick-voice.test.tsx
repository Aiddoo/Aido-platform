import '@src/shared/i18n/init';
import { AI_DATA_SHARING_CONSENT, PLAN_CATALOG } from '@aido/api/vocabulary';
import { createConsent } from '@src/features/auth/__tests__/auth.factories';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { AUTH_QUERY_KEYS } from '@src/features/auth/constants/auth-query-keys';
import type { Consent } from '@src/features/auth/domains/auth.model';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { createEntitlementSnapshot } from '@src/features/subscription/__tests__/entitlement.factories';
import { EntitlementService } from '@src/features/subscription/apis/entitlement.service';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/subscription/constants/entitlement-query-keys';
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
import { NetworkError } from '@src/shared/errors';
import { ApiError } from '@src/shared/errors/api-error';
import { err, ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider, Text } from '@src/shared/ui';
import { onlineManager } from '@tanstack/react-query';
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
const RENEWAL_SUBTITLE = 'AI 처리 업체가 늘어나 안내를 다시 드려요.';
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
      <Pressable
        testID="start"
        onPress={() => {
          quickVoice.start().catch(jest.fn());
        }}
      />
      <Pressable testID="finish" onPress={quickVoice.finish} />
      <Pressable testID="retry" onPress={quickVoice.retryPlanning} />
      <Pressable testID="type-instead" onPress={quickVoice.typeInstead} />
      <Pressable testID="cancel-planning" onPress={quickVoice.cancelPlanning} />
      <Pressable
        testID="start"
        onPress={() => {
          quickVoice.start().catch(jest.fn());
        }}
      />
      <Pressable
        testID="continue-as-note"
        onPress={() => {
          quickVoice.continueAsVoiceNote().catch(jest.fn());
        }}
      />
      <Text testID="status">{state.status}</Text>
      <Text testID="consent-required">{String(quickVoice.isConsentRequired)}</Text>
      <Text testID="title">{title}</Text>
      <Text testID="plan">
        {state.status === 'review'
          ? state.plan.actions.map((action) => action.title).join(',')
          : ''}
      </Text>
    </>
  );
}

async function renderQuickVoice({
  consent,
  isCoachmarkSeen = true,
  aiParseUsed,
}: { consent?: Partial<Consent>; isCoachmarkSeen?: boolean; aiParseUsed?: number } = {}) {
  const httpClient = createMockHttpClient();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();
  const voiceNoteStorage = createVoiceNoteStorageServiceFake();
  const onExit = jest.fn();
  const analytics = createMockAnalytics();
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: ACCOUNT_ID });
  if (consent != null) {
    queryClient.setQueryData(AUTH_QUERY_KEYS.consent(), createConsent(consent));
  }
  if (aiParseUsed != null) {
    queryClient.setQueryData(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      createEntitlementSnapshot({ used: { AI_PARSE: aiParseUsed } }),
    );
  }

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
        coachmarkService: new CoachmarkService({
          isSeen: () => isCoachmarkSeen,
          markSeen: jest.fn(),
        }),
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

  return { httpClient, speechRecognizer, voiceNoteStorage, onExit, analytics, queryClient };
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

  describe('시작 순서', () => {
    const PREVIOUS_AGREEMENT: Partial<Consent> = {
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: '2026-10-26',
    };

    it('한도를 다 썼으면 한도 안내에서 멈추고 동의와 마이크를 묻지 않는다', async () => {
      // Given
      const { speechRecognizer, analytics } = await renderQuickVoice({
        consent: PREVIOUS_AGREEMENT,
        isCoachmarkSeen: false,
        aiParseUsed: PLAN_CATALOG.AI_PARSE.free,
      });

      // When
      await fireEvent.press(screen.getByTestId('start'));

      // Then
      await waitFor(() =>
        expect(analytics.trackEvent).toHaveBeenCalledWith(
          'limit_reached_shown',
          expect.objectContaining({ surface: 'add_todo_sheet' }),
        ),
      );
      expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
      expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
    });

    it('이전 안내에 동의한 사람은 재안내를 닫은 뒤에야 마이크 권한을 묻는다', async () => {
      // Given
      const { speechRecognizer } = await renderQuickVoice({
        consent: PREVIOUS_AGREEMENT,
        isCoachmarkSeen: false,
      });

      // When
      await fireEvent.press(screen.getByTestId('start'));
      await screen.findByTestId('ai-consent-sheet');

      // Then
      expect(screen.getByText(RENEWAL_SUBTITLE)).toBeOnTheScreen();
      expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByTestId('ai-consent-later'));
      await waitFor(() => expect(speechRecognizer.getPermission).toHaveBeenCalledWith('quick'));
    });

    it('처음 쓰는 사람은 첫 안내를 닫은 뒤에야 마이크 권한을 묻는다', async () => {
      // Given
      const { speechRecognizer } = await renderQuickVoice({ consent: {}, isCoachmarkSeen: false });

      // When
      await fireEvent.press(screen.getByTestId('start'));
      await screen.findByTestId('ai-consent-sheet');

      // Then
      expect(screen.queryByText(RENEWAL_SUBTITLE)).toBeNull();
      expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByTestId('ai-consent-later'));
      await waitFor(() => expect(speechRecognizer.getPermission).toHaveBeenCalledWith('quick'));
    });

    it('재안내를 이미 본 계정은 안내 없이 바로 마이크 권한을 묻는다', async () => {
      // Given
      const { speechRecognizer } = await renderQuickVoice({
        consent: PREVIOUS_AGREEMENT,
        isCoachmarkSeen: true,
      });

      // When
      await fireEvent.press(screen.getByTestId('start'));

      // Then
      await waitFor(() => expect(speechRecognizer.getPermission).toHaveBeenCalledWith('quick'));
      expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
    });
  });

  describe('정리가 동의 때문에 막혔을 때', () => {
    it('처음 안내에서 나중에를 눌렀어도 다시 정리하면 안내를 다시 띄우고 동의하면 이어서 정리한다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderQuickVoice({
        consent: {},
        isCoachmarkSeen: false,
      });
      httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1311', '동의 필요', 403)));
      await fireEvent.press(screen.getByTestId('start'));
      await screen.findByTestId('ai-consent-sheet');
      await fireEvent.press(screen.getByTestId('ai-consent-later'));
      await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      await act(async () =>
        speechRecognizer.emit({
          type: 'result',
          transcript: '말한 내용',
          isFinal: true,
          segments: [],
        }),
      );
      await fireEvent.press(screen.getByTestId('finish'));
      await act(async () => speechRecognizer.emit({ type: 'end' }));
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));
      expect(screen.getByTestId('consent-required')).toHaveTextContent('true');
      expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
      httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1311', '동의 필요', 403)));
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT_ACTION])));
      httpClient.patch.mockResolvedValue(
        ok({
          aiDataSharingDecision: 'AGREED',
          aiDataSharingAgreedAt: '2026-11-05T00:00:00.000Z',
          aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
        }),
      );

      // When
      await fireEvent.press(screen.getByTestId('retry'));
      await screen.findByTestId('ai-consent-sheet');
      await fireEvent.press(screen.getByTestId('ai-consent-agree'));

      // Then
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
      expect(screen.getByTestId('consent-required')).toHaveTextContent('false');
    });
  });

  it('오프라인이어도 멈추지 않고 실패로 넘어가 글자를 입력 칸에 남긴다', async () => {
    // Given
    onlineManager.setOnline(false);
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockRejectedValue(new NetworkError());

    // When
    await speak(speechRecognizer);

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));
    expect(screen.getByTestId('title')).toHaveTextContent('말한 내용');
    onlineManager.setOnline(true);
  });

  it('정리를 기다리다 그만두면 요청을 끊고 글자를 입력 칸으로 옮긴다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockReturnValue(new Promise(() => undefined));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('planning'));

    // When
    await fireEvent.press(screen.getByTestId('cancel-planning'));

    // Then
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
    expect(screen.getByTestId('title')).toHaveTextContent('말한 내용');
    expect(httpClient.post.mock.calls[0]?.[2]?.signal?.aborted).toBe(true);
  });

  it('권한 오류로 실패한 뒤 마이크를 다시 누르면 글자를 유지한 채 새로 듣는다', async () => {
    // Given
    const { speechRecognizer, queryClient } = await renderQuickVoice();
    queryClient.setQueryData(
      AUTH_QUERY_KEYS.consent(),
      createConsent({ aiDataSharingDecision: 'AGREED', aiDataSharingConsentVersion: null }),
    );
    await fireEvent.press(screen.getByTestId('begin'));
    await act(async () => speechRecognizer.emit({ type: 'start' }));
    await act(async () =>
      speechRecognizer.emit({
        type: 'result',
        transcript: '말한 내용',
        isFinal: true,
        segments: [],
      }),
    );
    await act(async () => speechRecognizer.emit({ type: 'error', code: 'service-not-allowed' }));
    await act(async () => speechRecognizer.emit({ type: 'end' }));
    expect(screen.getByTestId('status')).toHaveTextContent('failed');

    // When
    await fireEvent.press(screen.getByTestId('start'));

    // Then
    await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('status')).toHaveTextContent('preparing');
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
