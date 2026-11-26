import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { AI_DATA_SHARING_CONSENT, AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import { fail, ok } from '@src/core/errors/result';
import { createAllSeenCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import {
  countGetRequests,
  createTodoServer,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import { NetworkError } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createApiError,
  createMemoryKeyValueStorage,
  createPendingResponse,
  createSpeechRecognizerStub,
  createTestDi,
  createTestQueryClient,
  createVoiceNoteStorageFake,
  deliverQueryNotifications,
  getTrackedEvents,
  type SpeechRecognizerStub,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';

import { TodoCreateBottomSheet } from './todo-create-bottom-sheet';

const PLACEHOLDER = '무엇을 하고 싶나요?';
const ACCOUNT_ID = createCurrentUserDto().userId;

function createPlanAction(overrides: Record<string, unknown>) {
  return {
    type: 'CREATE_TODO',
    key: 'a1',
    title: '운동',
    startDate: '2026-11-09',
    endDate: null,
    scheduledTime: null,
    repeat: null,
    visibility: null,
    items: [],
    categoryId: null,
    duplicateOfTodoId: null,
    ...overrides,
  };
}

const WORKOUT = createPlanAction({ key: 'a1', title: '운동' });
const MEETING = createPlanAction({ key: 'a2', title: '회의', categoryId: 2 });
const GROCERIES = createPlanAction({ key: 'a3', title: '장보기' });

function createQuickPlanDto(actions: unknown[], charged = true) {
  return {
    plan: { actions, omittedTodoCount: 0 },
    meta: {
      model: 'm',
      processingTimeMs: 1,
      tokenUsage: { input: 1, output: 1 },
      promptVersion: 'quick-plan@1',
    },
    featureQuota: null,
    charged,
  };
}

function createAppliedDto(titles: string[]) {
  return {
    todos: titles.map((title, index) => createTodoDto({ id: index + 1, title })),
    memo: null,
  };
}

async function renderCreateSheet(routeParams: Record<string, string> = {}) {
  const httpClient = createTodoServer();
  jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-10-27', ...routeParams });
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    CONSENT_QUERY_KEYS.detail(),
    createConsent({
      aiDataSharingDecision: AI_DATA_SHARING_DECISION.AGREED,
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    }),
  );
  const speechRecognizer = createSpeechRecognizerStub();
  const analytics = createAnalyticsStub();
  const onMemoChanged = jest.fn();

  await renderScreen(<TodoCreateBottomSheet onMemoChanged={onMemoChanged} />, {
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({
      ports: {
        httpClient,
        queryClient,
        ...createVoiceNoteStorageFake().ports,
        syncStorage: createAllSeenCoachmarkStorage(ACCOUNT_ID).syncStorage,
        speechRecognizer,
        analytics,
        storage: createMemoryKeyValueStorage(),
      },
    }),
  });
  await screen.findByPlaceholderText(PLACEHOLDER);
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  await act(() => deliverQueryNotifications());

  return { httpClient, speechRecognizer, analytics, queryClient };
}

/** 마이크를 눌러 듣기 시작하고 한 문장을 말한 뒤 끝낸다. 계획 응답은 먼저 정해 둔다 */
async function speak(speechRecognizer: SpeechRecognizerStub, transcript = '운동하고 회의') {
  const startCount = speechRecognizer.start.mock.calls.length;
  await fireEvent.press(screen.getByTestId('todo-quick-voice-button'));
  await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalledTimes(startCount + 1));
  await act(async () => speechRecognizer.emit({ type: 'start' }));
  await act(async () =>
    speechRecognizer.emit({ type: 'result', transcript, isFinal: true, segments: [] }),
  );
  await fireEvent.press(screen.getByTestId('quick-voice-finish'));
  await act(async () => speechRecognizer.emit({ type: 'end' }));
}

function findPosts(httpClient: ReturnType<typeof createTodoServer>, path: string) {
  return httpClient.post.mock.calls.filter(([postPath]) => postPath === path);
}

describe('TodoCreateBottomSheet 빠른 말하기', () => {
  // 저장 뒤 토스트와 연타 가드 타이머가 테스트 밖에 남지 않게 한다
  setupFakeTimersPerTest({ advanceTimers: true });

  describe('말하기에서 적용까지', () => {
    it('말한 글자를 계획으로 보내고 고른 카드를 시트의 카테고리와 함께 저장한 뒤 닫는다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT, MEETING])));
      httpClient.post.mockResolvedValueOnce(ok(createAppliedDto(['운동', '회의'])));
      await speak(speechRecognizer);

      // When
      await fireEvent.press(await screen.findByTestId('plan-review-apply'));

      // Then
      await waitFor(() => expect(findPosts(httpClient, 'v1/action-plans/apply')).toHaveLength(1));
      const [quickPlan] = findPosts(httpClient, 'v1/quick-plans');
      expect(quickPlan?.[1]).toEqual({ text: '운동하고 회의', source: 'VOICE' });
      const [applied] = findPosts(httpClient, 'v1/action-plans/apply');
      expect(applied?.[1]).toEqual({
        source: 'QUICK_VOICE',
        actions: [
          expect.objectContaining({ key: 'a1', title: '운동', categoryId: 1 }),
          expect.objectContaining({ key: 'a2', title: '회의', categoryId: 2 }),
        ],
      });
      expect(await screen.findAllByText('할 일 2개를 추가했어요')).not.toHaveLength(0);
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    });

    it('체크를 끈 카드는 보내지 않는다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT, MEETING])));
      httpClient.post.mockResolvedValueOnce(ok(createAppliedDto(['회의'])));
      await speak(speechRecognizer);
      await fireEvent.press(await screen.findByLabelText('운동 추가하기'));

      // When
      await fireEvent.press(screen.getByRole('button', { name: '할 일 1개 추가' }));

      // Then
      await waitFor(() => expect(findPosts(httpClient, 'v1/action-plans/apply')).toHaveLength(1));
      const [applied] = findPosts(httpClient, 'v1/action-plans/apply');
      expect(applied?.[1]).toEqual({
        source: 'QUICK_VOICE',
        actions: [expect.objectContaining({ key: 'a2', title: '회의' })],
      });
    });

    it('카드를 눌러 제목을 고치면 고친 제목으로 보낸다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT])));
      httpClient.post.mockResolvedValueOnce(ok(createAppliedDto(['아침 운동'])));
      await speak(speechRecognizer);
      await fireEvent.press(await screen.findByText('운동'));
      await fireEvent.changeText(await screen.findByLabelText('할 일 제목'), '아침 운동');
      await fireEvent.press(screen.getByTestId('plan-todo-edit-confirm'));

      // When
      await fireEvent.press(await screen.findByTestId('plan-review-apply'));

      // Then
      await waitFor(() => expect(findPosts(httpClient, 'v1/action-plans/apply')).toHaveLength(1));
      const [applied] = findPosts(httpClient, 'v1/action-plans/apply');
      expect(applied?.[1]).toEqual({
        source: 'QUICK_VOICE',
        actions: [expect.objectContaining({ key: 'a1', title: '아침 운동' })],
      });
    });

    it('카테고리가 나뉘어 온 카드는 묶어 보인 순서로 보낸다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT, MEETING, GROCERIES])));
      httpClient.post.mockResolvedValueOnce(ok(createAppliedDto(['운동', '장보기', '회의'])));
      await speak(speechRecognizer);

      // When
      await fireEvent.press(await screen.findByTestId('plan-review-apply'));

      // Then
      await waitFor(() => expect(findPosts(httpClient, 'v1/action-plans/apply')).toHaveLength(1));
      const [applied] = findPosts(httpClient, 'v1/action-plans/apply');
      expect(applied?.[1]).toEqual({
        source: 'QUICK_VOICE',
        actions: [
          expect.objectContaining({ key: 'a1', categoryId: 1 }),
          expect.objectContaining({ key: 'a3', categoryId: 1 }),
          expect.objectContaining({ key: 'a2', categoryId: 2 }),
        ],
      });
    });

    it('추가를 같은 프레임에 두 번 눌러도 저장 요청과 저장 이벤트는 한 번이다', async () => {
      // Given
      const { httpClient, speechRecognizer, analytics } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT])));
      const saved = createPendingResponse(ok(createAppliedDto(['운동'])));
      httpClient.post.mockReturnValue(saved.response);
      await speak(speechRecognizer);
      const apply = await screen.findByTestId('plan-review-apply');

      // When
      await act(async () => {
        await fireEvent.press(apply);
        await fireEvent.press(apply);
      });

      // Then
      const keys = findPosts(httpClient, 'v1/action-plans/apply').map(
        ([, , config]) => config?.headers?.['Idempotency-Key'],
      );
      expect(keys).toHaveLength(1);

      // When
      await act(async () => saved.settle());
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(getTrackedEvents(analytics, 'voice_plan_applied')).toHaveLength(1);
      expect(findPosts(httpClient, 'v1/action-plans/apply')).toHaveLength(1);
    });
  });

  describe('분석 이벤트와 조회', () => {
    it('말하고 고르고 저장하는 동안 동작마다 이벤트를 한 번씩 보낸다', async () => {
      // Given
      const { httpClient, speechRecognizer, analytics } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT])));
      httpClient.post.mockResolvedValueOnce(ok(createAppliedDto(['운동'])));

      // When
      await speak(speechRecognizer);
      await fireEvent.press(await screen.findByTestId('plan-review-apply'));
      await waitFor(() =>
        expect(getTrackedEvents(analytics, 'voice_plan_applied')).toHaveLength(1),
      );

      // Then
      expect(getTrackedEvents(analytics, 'voice_capture_started')).toHaveLength(1);
      expect(getTrackedEvents(analytics, 'voice_capture_finished')).toHaveLength(1);
      expect(getTrackedEvents(analytics, 'voice_plan_generated')).toHaveLength(1);
      expect(getTrackedEvents(analytics, 'voice_plan_failed')).toHaveLength(0);
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_plan_applied', {
        source: 'quick_voice',
        todo_count: 1,
        memo_count: 0,
        skipped_count: 0,
      });
    });

    it('시트를 처음 열 때 같은 조회를 두 번 보내지 않는다', async () => {
      // When
      const { httpClient } = await renderCreateSheet();

      // Then
      for (const count of Object.values(countGetRequests(httpClient))) {
        expect(count).toBe(1);
      }
      expect(countGetRequests(httpClient)['v1/todo-categories']).toBe(1);
    });
  });

  describe('다시 말하기와 직접 입력', () => {
    it('다시 말하기를 누르면 계획을 버리고 새로 듣는다', async () => {
      // Given
      const { httpClient, speechRecognizer, analytics } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT])));
      await speak(speechRecognizer);

      // When
      await fireEvent.press(await screen.findByTestId('quick-voice-restart'));

      // Then
      await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalledTimes(2));
      expect(await screen.findByTestId('quick-voice-listening')).toBeOnTheScreen();
      expect(getTrackedEvents(analytics, 'voice_capture_started')).toHaveLength(2);
      expect(findPosts(httpClient, 'v1/action-plans/apply')).toHaveLength(0);
    });

    it('찾은 할 일이 없어 직접 입력으로 돌아오면 적어 둔 제목에 들은 글자를 잇고 고른 날짜는 그대로다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderCreateSheet();
      await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '장보기');
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([], false)));
      await speak(speechRecognizer, '우유 사기');

      // When
      await fireEvent.press(await screen.findByTestId('quick-voice-type-instead'));

      // Then
      expect(await screen.findByPlaceholderText(PLACEHOLDER)).toHaveDisplayValue(
        '장보기 우유 사기',
      );
      httpClient.post.mockResolvedValueOnce(
        ok({ message: 'ok', todo: createTodoDto({ id: 9, title: '장보기 우유 사기' }) }),
      );
      await fireEvent.press(screen.getByTestId('todo-add-submit'));
      await waitFor(() => expect(findPosts(httpClient, 'v1/todos')).toHaveLength(1));
      expect(findPosts(httpClient, 'v1/todos')[0]?.[1]).toEqual(
        expect.objectContaining({
          title: '장보기 우유 사기',
          startDate: '2026-10-27',
          categoryId: 1,
        }),
      );
    });
  });

  describe('정리 실패', () => {
    it('정리에 실패하면 들은 글자를 제목 칸에 남기고 남겨뒀다고 알린다', async () => {
      // Given
      const { httpClient, speechRecognizer, analytics } = await renderCreateSheet();
      httpClient.post.mockRejectedValueOnce(new NetworkError());

      // When
      await speak(speechRecognizer, '우유 사기');

      // Then
      expect(await screen.findByTestId('quick-voice-failed')).toHaveTextContent(
        /들은 내용은 남겨뒀어요/,
      );
      expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveDisplayValue('우유 사기');
      expect(getTrackedEvents(analytics, 'voice_plan_failed')).toHaveLength(1);
      expect(getTrackedEvents(analytics, 'voice_plan_generated')).toHaveLength(0);
    });

    it('이번 달 횟수를 다 썼다고 거절되면 한도 안내를 띄우고 들은 글자를 남긴다', async () => {
      // Given
      const { httpClient, speechRecognizer, analytics } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(
        fail(createApiError(ErrorCode.AI_1303, { message: '한도 초과' })),
      );

      // When
      await speak(speechRecognizer, '우유 사기');

      // Then
      expect(await screen.findByText('이번 달 AI 할 일 만들기를 다 썼어요')).toBeOnTheScreen();
      expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveDisplayValue('우유 사기');
      expect(getTrackedEvents(analytics, 'voice_plan_failed')).toHaveLength(1);
    });

    it('동의가 필요하다고 거절돼 나중에를 누르면 동의가 필요하다고 알리고 들은 글자를 남긴다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(
        fail(createApiError(ErrorCode.AI_1311, { message: '동의 필요' })),
      );
      await speak(speechRecognizer, '우유 사기');

      // When
      await fireEvent.press(await screen.findByRole('button', { name: '나중에' }));

      // Then
      expect(await screen.findByTestId('quick-voice-failed')).toHaveTextContent(
        /정리하려면 AI 동의가 필요해요/,
      );
      expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveDisplayValue('우유 사기');
    });
  });

  describe('다시 그리기', () => {
    // 시트 맨 위(할 일 폼을 가진 컴포넌트)만 화면 떠남을 구독해, 그 호출 수가 맨 위가 그려진 횟수다
    function countSheetRenders() {
      return jest.mocked(useIsFocused).mock.calls.length;
    }

    it('계획 카드의 체크를 바꿔도 시트 맨 위는 다시 그려지지 않는다', async () => {
      // Given
      const { httpClient, speechRecognizer } = await renderCreateSheet();
      httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT, MEETING])));
      await speak(speechRecognizer);
      const checkbox = await screen.findByLabelText('운동 추가하기');
      const renderCountBeforeToggle = countSheetRenders();

      // When
      await fireEvent.press(checkbox);
      await fireEvent.press(checkbox);
      await fireEvent.press(checkbox);

      // Then
      expect(screen.getByRole('button', { name: '할 일 1개 추가' })).toBeOnTheScreen();
      expect(countSheetRenders()).toBe(renderCountBeforeToggle);
    });
  });
});
