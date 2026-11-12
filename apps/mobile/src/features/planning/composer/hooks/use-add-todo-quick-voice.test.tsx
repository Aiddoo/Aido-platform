import { AI_DATA_SHARING_CONSENT, PLAN_CATALOG } from '@aido/api/vocabulary';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import '@src/shared/i18n/init';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createCoachmarkRecords } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { type Consent } from '@src/features/identity/consent/domains/consent.model';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import { NetworkError } from '@src/shared/errors';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider, Text } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createMemoryKeyValueStorage,
  createSpeechRecognizerStub,
  createVoiceNoteStorageFake,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { onlineManager } from '@tanstack/react-query';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable, TextInput } from 'react-native';

import { useAddTodoQuickVoice } from './use-add-todo-quick-voice';

const ACCOUNT_ID = 'user-1';
const RENEWAL_SUBTITLE = 'AI 처리 업체가 늘어 다시 안내해요.';

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

/** 실패 상태로 그릴 때마다 입력 칸에 있던 글자 */
const titlesRenderedAsFailed: string[] = [];

function QuickVoiceProbe({ onExit }: { onExit: () => void }) {
  const form = useForm<TodoFormValues>({
    defaultValues: { title: '', startDate: createDateKey('2026-11-05'), repeat: null },
  });
  const quickVoice = useAddTodoQuickVoice({ form, onExit });
  const title = useWatch({ control: form.control, name: 'title' });
  const { state } = quickVoice;
  if (state.status === 'failed') {
    titlesRenderedAsFailed.push(title);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="begin"
        onPress={() =>
          quickVoice.begin({ locale: 'ko-KR', hintWords: [], recordingDirectory: null })
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="finish"
        onPress={quickVoice.finish}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="retry"
        onPress={quickVoice.retryPlanning}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="type-instead"
        onPress={quickVoice.typeInstead}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="cancel-planning"
        onPress={quickVoice.cancelPlanning}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="start"
        onPress={() => {
          quickVoice.start().catch(jest.fn());
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="continue-as-note"
        onPress={() => {
          quickVoice.continueAsVoiceNote().catch(jest.fn());
        }}
      />
      <Text testID="status">{state.status}</Text>
      <Text testID="consent-required">{String(quickVoice.isConsentRequired)}</Text>
      <Text testID="title">{title}</Text>
      <TextInput
        accessibilityLabel="title-input"
        onChangeText={(text) => form.setValue('title', text, { shouldDirty: true })}
      />
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
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();
  const voice = createVoiceNoteStorageFake();
  const onExit = jest.fn();
  const analytics = createAnalyticsStub();
  const queryClient = createTestQueryClient();
  const syncStorage = createMemoryObservableSyncStorage();
  if (isCoachmarkSeen) {
    createCoachmarkRecords(syncStorage).markSeen({
      accountId: ACCOUNT_ID,
      kind: 'ai-consent-renewal',
    });
  }
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  if (consent != null) {
    queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), createConsent(consent));
  }
  if (aiParseUsed != null) {
    queryClient.setQueryData(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      createEntitlementSnapshot({ used: { AI_PARSE: aiParseUsed } }),
    );
  }

  const di = createTestDi({
    ports: {
      queryClient,
      httpClient,
      ...voice.ports,
      syncStorage,
      speechRecognizer,
      analytics,
      storage: createMemoryKeyValueStorage(),
    },
  });
  const { rerender } = await renderScreen(
    <LocalDateProvider>
      <OverlayProvider>
        <QuickVoiceProbe onExit={onExit} />
      </OverlayProvider>
    </LocalDateProvider>,
    { di },
  );

  /** 시트만 닫는다. 안내는 앱 위 오버레이에 있어 그대로 남는다 */
  const closeSheet = () =>
    rerender(
      <LocalDateProvider>
        <OverlayProvider>{null}</OverlayProvider>
      </LocalDateProvider>,
    );

  return {
    httpClient,
    speechRecognizer,
    di,
    onExit,
    analytics,
    queryClient,
    closeSheet,
  };
}

async function speak(speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>) {
  await userEvent.press(screen.getByRole('button', { name: 'begin' }));
  await act(async () => speechRecognizer.emit({ type: 'start' }));
  await act(async () =>
    speechRecognizer.emit({ type: 'result', transcript: '말한 내용', isFinal: true, segments: [] }),
  );
  await userEvent.press(screen.getByRole('button', { name: 'finish' }));
  await act(async () => speechRecognizer.emit({ type: 'end' }));
}

const getIdempotencyKey = (
  httpClient: ReturnType<typeof createHttpClientStub>,
  callIndex: number,
) => httpClient.post.mock.calls[callIndex]?.[2]?.headers?.['Idempotency-Key'];

describe('useAddTodoQuickVoice', () => {
  // 동의를 미룬 뒤 뜨는 토스트 타이머가 테스트 밖에 남지 않게 한다
  setupFakeTimersPerTest({ advanceTimers: true });

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
    const user = userEvent.setup();
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1301', '실패', 503)));
    httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT_ACTION])));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));

    // When
    await user.press(screen.getByRole('button', { name: 'retry' }));

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(screen.getByTestId('title')).toHaveTextContent('말한 내용');
    expect(getIdempotencyKey(httpClient, 1)).toBe(getIdempotencyKey(httpClient, 0));
  });

  it('내용이 다르다는 오류(AI_1318) 뒤에는 새 키로 보낸다', async () => {
    // Given
    const user = userEvent.setup();
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1318', '다른 내용', 422)));
    httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT_ACTION])));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));

    // When
    await user.press(screen.getByRole('button', { name: 'retry' }));

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(getIdempotencyKey(httpClient, 1)).not.toBe(getIdempotencyKey(httpClient, 0));
  });

  it('찾은 할 일이 없으면 직접 입력을 고를 때 들은 글자를 입력 칸으로 옮긴다', async () => {
    // Given
    const user = userEvent.setup();
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValue(ok(createQuickPlanDto([], false)));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));

    // When
    await user.press(screen.getByRole('button', { name: 'type-instead' }));

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
      const user = userEvent.setup();
      const { speechRecognizer, analytics } = await renderQuickVoice({
        consent: PREVIOUS_AGREEMENT,
        isCoachmarkSeen: false,
        aiParseUsed: PLAN_CATALOG.AI_PARSE.free,
      });

      // When
      await user.press(screen.getByRole('button', { name: 'start' }));

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
      const user = userEvent.setup();
      const { speechRecognizer } = await renderQuickVoice({
        consent: PREVIOUS_AGREEMENT,
        isCoachmarkSeen: false,
      });

      // When
      await user.press(screen.getByRole('button', { name: 'start' }));
      await screen.findByTestId('ai-consent-sheet');

      // Then
      expect(screen.getByText(RENEWAL_SUBTITLE)).toBeOnTheScreen();
      expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
      await user.press(screen.getByRole('button', { name: '나중에' }));
      await waitFor(() =>
        expect(speechRecognizer.getPermission).toHaveBeenCalledWith('quick', 'ko-KR'),
      );
    });

    it('동의 상태를 읽는 사이 시트가 닫히면 마이크 권한을 묻지 않는다', async () => {
      // Given
      const user = userEvent.setup();
      const { httpClient, speechRecognizer, closeSheet } = await renderQuickVoice();
      const consentRead = Promise.withResolvers<never>();
      httpClient.get.mockReturnValue(consentRead.promise);
      await user.press(screen.getByRole('button', { name: 'start' }));
      await act(async () => closeSheet());

      // When
      await act(async () => consentRead.reject(new Error('offline')));

      // Then
      expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
    });

    it('마이크 권한을 기다리는 사이 시트가 닫히면 인식기를 시작하지 않고 분석도 남기지 않는다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, analytics, queryClient, closeSheet } = await renderQuickVoice();
      queryClient.setQueryData(
        CONSENT_QUERY_KEYS.detail(),
        createConsent({ aiDataSharingDecision: 'AGREED', aiDataSharingConsentVersion: null }),
      );
      await user.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      await act(async () => speechRecognizer.emit({ type: 'error', code: 'service-not-allowed' }));
      analytics.trackEvent.mockClear();
      speechRecognizer.start.mockClear();
      const permission = Promise.withResolvers<{ isGranted: true; canAskAgain: boolean }>();
      speechRecognizer.getPermission.mockReturnValue(permission.promise);
      await user.press(screen.getByRole('button', { name: 'start' }));
      await waitFor(() => expect(speechRecognizer.getPermission).toHaveBeenCalled());
      await act(async () => closeSheet());

      // When
      await act(async () => permission.resolve({ isGranted: true, canAskAgain: true }));

      // Then
      expect(speechRecognizer.start).not.toHaveBeenCalled();
      expect(analytics.trackEvent).not.toHaveBeenCalledWith(
        'voice_capture_finished',
        expect.anything(),
      );
    });

    it('처음 쓰는 사람이 나중에를 누르면 마이크 권한을 묻지 않고 AI에도 보내지 않은 채 멈춘다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer, httpClient } = await renderQuickVoice({ consent: {} });
      await user.press(screen.getByRole('button', { name: 'start' }));
      await screen.findByTestId('ai-consent-sheet');
      expect(screen.queryByText(RENEWAL_SUBTITLE)).toBeNull();

      // When
      await user.press(screen.getByRole('button', { name: '나중에' }));

      // Then
      await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());
      expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
      expect(speechRecognizer.start).not.toHaveBeenCalled();
      expect(screen.getByTestId('status')).toHaveTextContent('idle');
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('처음 쓰는 사람이 나중에를 눌러도 입력하던 글자는 남고 다시 누르면 안내를 다시 띄운다', async () => {
      // Given
      const user = userEvent.setup();
      await renderQuickVoice({ consent: {} });
      await user.type(screen.getByLabelText('title-input'), '우유 사기');
      await user.press(screen.getByRole('button', { name: 'start' }));
      await user.press(await screen.findByRole('button', { name: '나중에' }));
      await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());
      expect(screen.getByTestId('title')).toHaveTextContent('우유 사기');

      // When
      await user.press(screen.getByRole('button', { name: 'start' }));

      // Then
      expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
    });

    it('재안내를 이미 본 계정은 안내 없이 바로 마이크 권한을 묻는다', async () => {
      // Given
      const user = userEvent.setup();
      const { speechRecognizer } = await renderQuickVoice({
        consent: PREVIOUS_AGREEMENT,
        isCoachmarkSeen: true,
      });

      // When
      await user.press(screen.getByRole('button', { name: 'start' }));

      // Then
      await waitFor(() =>
        expect(speechRecognizer.getPermission).toHaveBeenCalledWith('quick', 'ko-KR'),
      );
      expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
    });
  });

  describe('정리가 동의 때문에 막혔을 때', () => {
    it('듣는 동안 동의가 사라져 정리에서 나중에를 눌러도 다시 정리하면 안내를 다시 띄우고 동의하면 이어서 정리한다', async () => {
      // Given
      const user = userEvent.setup();
      const { httpClient, speechRecognizer } = await renderQuickVoice({
        consent: {
          aiDataSharingDecision: 'AGREED',
          aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
        },
      });
      httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1311', '동의 필요', 403)));
      await user.press(screen.getByRole('button', { name: 'start' }));
      await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalled());
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      await act(async () =>
        speechRecognizer.emit({
          type: 'result',
          transcript: '말한 내용',
          isFinal: true,
          segments: [],
        }),
      );
      await user.press(screen.getByRole('button', { name: 'finish' }));
      await act(async () => speechRecognizer.emit({ type: 'end' }));
      await user.press(await screen.findByRole('button', { name: '나중에' }));
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
      await user.press(screen.getByRole('button', { name: 'retry' }));
      await screen.findByTestId('ai-consent-sheet');
      await user.press(screen.getByRole('button', { name: '동의하고 계속' }));

      // Then
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
      expect(screen.getByTestId('consent-required')).toHaveTextContent('false');
    });
  });

  it('앱을 오프라인으로 열어 동의 상태를 모르면 마이크를 눌렀을 때 묻지 않고 듣기 시작한다', async () => {
    // Given
    const user = userEvent.setup();
    onlineManager.setOnline(false);
    const { speechRecognizer } = await renderQuickVoice();

    // When
    await user.press(screen.getByRole('button', { name: 'start' }));

    // Then
    await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalledTimes(1));
    onlineManager.setOnline(true);
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

  it('정리에 실패하면 입력 칸이 빈 채로 그려지는 순간 없이 글자를 넣는다', async () => {
    // Given
    titlesRenderedAsFailed.length = 0;
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockRejectedValue(new NetworkError());

    // When
    await speak(speechRecognizer);

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));
    expect(titlesRenderedAsFailed.length).toBeGreaterThan(0);
    expect(titlesRenderedAsFailed.every((title) => title === '말한 내용')).toBe(true);
  });

  it('정리를 기다리다 그만두면 요청을 끊고 글자를 입력 칸으로 옮긴다', async () => {
    // Given
    const user = userEvent.setup();
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockReturnValue(new Promise(() => undefined));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('planning'));

    // When
    await user.press(screen.getByRole('button', { name: 'cancel-planning' }));

    // Then
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
    expect(screen.getByTestId('title')).toHaveTextContent('말한 내용');
    expect(httpClient.post.mock.calls[0]?.[2]?.signal?.aborted).toBe(true);
  });

  it('권한 오류로 실패한 뒤 마이크를 다시 누르면 글자를 유지한 채 새로 듣는다', async () => {
    // Given
    const user = userEvent.setup();
    const { speechRecognizer, queryClient } = await renderQuickVoice();
    queryClient.setQueryData(
      CONSENT_QUERY_KEYS.detail(),
      createConsent({ aiDataSharingDecision: 'AGREED', aiDataSharingConsentVersion: null }),
    );
    await user.press(screen.getByRole('button', { name: 'begin' }));
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
    await user.press(screen.getByRole('button', { name: 'start' }));

    // Then
    await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('status')).toHaveTextContent('preparing');
    expect(screen.getByTestId('title')).toHaveTextContent('말한 내용');
  });

  describe('90초 제안', () => {
    async function listenUntilLimit(
      speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>,
    ) {
      await userEvent.press(screen.getByRole('button', { name: 'begin' }));
      await act(async () => speechRecognizer.emit({ type: 'start' }));
      await act(async () =>
        speechRecognizer.emit({
          type: 'result',
          transcript: '길게 말한 내용.',
          isFinal: true,
          segments: [],
        }),
      );
      await act(async () => jest.advanceTimersByTimeAsync(90_100));
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
      const user = userEvent.setup();
      const { httpClient, speechRecognizer } = await renderQuickVoice();
      httpClient.post.mockResolvedValue(ok(createQuickPlanDto([WORKOUT_ACTION])));
      await listenUntilLimit(speechRecognizer);

      // When
      await user.press(screen.getByRole('button', { name: 'finish' }));

      // Then
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
      expect(httpClient.post.mock.calls[0]?.[1]).toEqual({
        text: '길게 말한 내용.',
        source: 'VOICE',
      });
    });

    it('말로 메모하기를 고르면 들은 글자를 초안에 저장하고 시트를 닫은 뒤 이어 듣기로 간다', async () => {
      // Given
      const user = userEvent.setup();
      const { httpClient, speechRecognizer, di, onExit, analytics } = await renderQuickVoice();
      await listenUntilLimit(speechRecognizer);
      // 동의 상태를 읽지 못하면 묻지 않고 넘어간다
      httpClient.get.mockRejectedValue(new Error('offline'));

      // When
      await user.press(screen.getByRole('button', { name: 'continue-as-note' }));

      // Then
      await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
      const [note] = di.voiceNoteDraftRepository.findAll(ACCOUNT_ID);
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
      const user = userEvent.setup();
      const { httpClient, speechRecognizer, di, onExit } = await renderQuickVoice();
      await listenUntilLimit(speechRecognizer);
      httpClient.get.mockRejectedValue(new Error('offline'));
      const denied = { isGranted: false, canAskAgain: true, missing: 'microphone' } as const;
      speechRecognizer.getPermission.mockResolvedValue(denied);
      speechRecognizer.requestPermission.mockResolvedValue(denied);

      // When
      await user.press(screen.getByRole('button', { name: 'continue-as-note' }));
      await waitFor(() => expect(speechRecognizer.requestPermission).toHaveBeenCalled());

      // Then
      expect(screen.getByTestId('status')).toHaveTextContent('paused');
      expect(onExit).not.toHaveBeenCalled();
      expect(di.voiceNoteDraftRepository.findAll(ACCOUNT_ID)).toEqual([]);
    });
  });
});
