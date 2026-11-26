import { fail, ok } from '@src/core/errors/result';
import '@src/shared/i18n/init';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createAllSeenCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createPreference } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createMemo } from '@src/features/notes/memo/__tests__/memo.fixtures';
import { MEMO_QUERY_KEYS } from '@src/features/notes/memo/queries/memo-query-keys';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/queries/todo-category-query-keys';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { toInstant } from '@src/shared/date/instant';
import { NetworkError } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createAppLoggerStub,
  createMemoryKeyValueStorage,
  createPendingResponse,
  createTestDi,
  createTestQueryClient,
  createVoiceNoteStorageFake,
  stubWindowDimensions,
  createApiError,
  getTrackedEvents,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';

import VoiceNoteRoute from '../../../../app/(app)/voice-notes/[draftId]';
import { createPlanReviewDraft } from '../domains/plan-review-draft.model';
import { voicePlanSchema } from '../domains/voice-plan.model';
import { createVoiceNoteDigest, createSpokenVoiceNote } from './voice-note.fixtures';
import { createVoiceNoteDigestDto } from './voice.fixtures';

const ACCOUNT_ID = 'user-1';
const DRAFT_ID = 'draft-1';
let logger: ReturnType<typeof createAppLoggerStub>;

beforeEach(() => {
  logger = createAppLoggerStub();
});

const planDraftWithTodo = createPlanReviewDraft(
  voicePlanSchema.parse({
    planId: DRAFT_ID,
    source: 'voice-note',
    sourceMemoId: null,
    omittedTodoCount: 0,
    actions: [
      {
        type: 'create-todo',
        actionId: 'todo-1',
        title: '운동',
        startDate: '2026-11-05',
        endDate: null,
        scheduledTime: null,
        repeat: null,
        visibility: null,
        items: [],
        categoryId: 1,
        duplicateOfTodoId: null,
      },
    ],
  }),
);

const emptyPlanDraft = createPlanReviewDraft(
  voicePlanSchema.parse({
    planId: DRAFT_ID,
    source: 'voice-note',
    sourceMemoId: null,
    omittedTodoCount: 0,
    actions: [],
  }),
);

async function renderVoiceNote(
  note: Parameters<typeof createSpokenVoiceNote>[0],
  tab?: string,
  entitlements = createEntitlementSnapshot(),
) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ draftId: DRAFT_ID, tab });
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), entitlements);
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [
      { id: 1, name: '기본', color: '#3B82F6', sortOrder: 0, todoCount: 0 },
      { id: 2, name: '업무', color: '#EF4444', sortOrder: 1, todoCount: 0 },
    ],
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    createPreference({ timeFormat: 'TWELVE_HOUR' }),
  );
  const analytics = createAnalyticsStub();
  const di = createTestDi({
    ports: {
      httpClient,
      queryClient,
      analytics,
      syncStorage: createAllSeenCoachmarkStorage(ACCOUNT_ID).syncStorage,
      storage: createMemoryKeyValueStorage(),
      ...createVoiceNoteStorageFake().ports,
      logger,
    },
  });
  di.voiceNoteDraftRepository.save(
    ACCOUNT_ID,
    createSpokenVoiceNote({ draftId: DRAFT_ID, ...note }),
  );

  const { unmount } = await renderScreen(<VoiceNoteRoute />, {
    di,
    withLocalDate: true,
    withOverlay: true,
  });

  return { httpClient, di, unmount, queryClient, analytics };
}

function findPosts(httpClient: ReturnType<typeof createHttpClientStub>, path: string) {
  return httpClient.post.mock.calls.filter(([postPath]) => postPath === path);
}

function createPlanTodoAction(overrides: Record<string, unknown>) {
  return {
    type: 'create-todo',
    actionId: 'todo-1',
    title: '운동',
    startDate: '2026-11-05',
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

/** 운동(정하지 않음)·회의(업무)·장보기(정하지 않음). 정하지 않은 카드는 기본 카테고리로 묶인다 */
const planDraftWithThreeTodos = createPlanReviewDraft(
  voicePlanSchema.parse({
    planId: DRAFT_ID,
    source: 'voice-note',
    sourceMemoId: null,
    omittedTodoCount: 0,
    actions: [
      createPlanTodoAction({ actionId: 'todo-1', title: '운동' }),
      createPlanTodoAction({ actionId: 'todo-2', title: '회의', categoryId: 2 }),
      createPlanTodoAction({ actionId: 'todo-3', title: '장보기' }),
    ],
  }),
);

describe('VoiceNoteRoute', () => {
  describe('말로 메모 화면', () => {
    // 화면을 떠난 뒤 오는 응답·동의 결과가 토스트를 띄워도 타이머가 테스트 밖에 남지 않게 한다
    setupFakeTimersPerTest({ advanceTimers: true });

    it('정리 전에는 들은 글자와 정리하기, 쓰게 될 횟수를 보여 준다', async () => {
      // Given
      await renderVoiceNote({});

      // When
      const button = await screen.findByRole('button', { name: '정리하기' });

      // Then
      expect(button).toBeOnTheScreen();
      expect(screen.getByTestId('voice-note-digest-cost')).toHaveTextContent(
        '1번 사용 · 이번 달 3번 남음',
      );
    });

    it('프리미엄은 정리할 때 쓰는 횟수 문구를 숨긴다', async () => {
      // Given
      await renderVoiceNote({}, undefined, createEntitlementSnapshot({ tier: 'PREMIUM' }));

      // When
      const button = await screen.findByRole('button', { name: '정리하기' });

      // Then
      expect(button).toBeOnTheScreen();
      expect(screen.queryByTestId('voice-note-digest-cost')).toBeNull();
    });

    it('정리에 실패하면 글자를 남기고 차감되지 않았을 때만 그렇게 말하며 다시 정리를 보인다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient } = await renderVoiceNote({});
      httpClient.post.mockResolvedValue(
        fail(createApiError('AI_1301', { message: '실패', details: { charged: false } })),
      );

      // When
      await user.press(await screen.findByRole('button', { name: '정리하기' }));

      // Then
      expect(await screen.findByText('다시 정리')).toBeOnTheScreen();
      expect(screen.getByTestId('voice-note-digest-failure')).toHaveTextContent(
        /횟수는 차감되지 않았어요/,
      );
    });

    it('연결이 안 돼 정리하지 못하면 연결되면 다시 정리할 수 있다고 알린다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient } = await renderVoiceNote({});
      httpClient.post.mockRejectedValue(new NetworkError());

      // When
      await user.press(await screen.findByRole('button', { name: '정리하기' }));

      // Then
      const failure = await screen.findByTestId('voice-note-digest-failure');
      expect(failure).toHaveTextContent(/인터넷에 연결되지 않았어요/);
      expect(failure).toHaveTextContent(/인터넷에 연결되면 다시 정리할 수 있어요/);
      expect(screen.getByText('다시 정리')).toBeOnTheScreen();
    });

    it('너무 길어 정리하지 못하면 이유를 알리고 소용없는 다시 정리를 보이지 않는다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient } = await renderVoiceNote({});
      httpClient.post.mockResolvedValue(fail(createApiError('AI_1312', { message: '너무 김' })));

      // When
      await user.press(await screen.findByRole('button', { name: '정리하기' }));

      // Then
      expect(await screen.findByTestId('voice-note-digest-failure')).toHaveTextContent(
        /한 번에 정리할 수 있는 길이를 넘었어요/,
      );
      expect(screen.queryByText('다시 정리')).toBeNull();
      expect(screen.getByLabelText('더 보기')).toBeOnTheScreen();
    });

    it('정리가 끝나면 결과로 바뀌고 할 일이 없으면 요약을 남겼다고 알린다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient } = await renderVoiceNote({});
      httpClient.post.mockResolvedValue(ok(createVoiceNoteDigestDto({ keyPoints: [] })));

      // When
      await user.press(await screen.findByRole('button', { name: '정리하기' }));

      // Then
      expect(await screen.findByText('요약이에요')).toBeOnTheScreen();
      expect(screen.getByTestId('voice-note-no-todos')).toHaveTextContent(
        '할 일로 나눌 내용은 없었어요. 요약을 남겨뒀어요.',
      );
    });

    it('메모로 저장하면 요약을 메모로 보내고 저장했다고 바뀐다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient } = await renderVoiceNote({
        digest: createVoiceNoteDigest({ keyPoints: [] }),
        planDraft: emptyPlanDraft,
      });
      httpClient.post.mockResolvedValue(ok({ todos: [], memo: null }));

      // When
      await user.press(await screen.findByRole('button', { name: '메모로 저장' }));

      // Then
      expect(await screen.findByRole('button', { name: '메모로 저장했어요' })).toBeDisabled();
      expect(httpClient.post.mock.calls[0]?.[0]).toBe('v1/action-plans/apply');
    });

    it('메모로 저장하면 메모 목록과 개수 한도를 다시 읽는다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient, queryClient } = await renderVoiceNote({
        digest: createVoiceNoteDigest({ keyPoints: [] }),
        planDraft: emptyPlanDraft,
      });
      queryClient.setQueryData(MEMO_QUERY_KEYS.list(), {
        pages: [{ items: [], nextCursor: null }],
        pageParams: [undefined],
      });
      queryClient.setQueryData(MEMO_QUERY_KEYS.resourceLimit(), {
        currentCount: 0,
        maxPerUser: 100,
      });
      httpClient.post.mockResolvedValue(
        ok({
          todos: [],
          memo: { ...createMemo(), userId: 'clz7x5p8k0001qz0z8z8z8z8z', sortOrder: 0 },
        }),
      );

      // When
      await user.press(await screen.findByRole('button', { name: '메모로 저장' }));

      // Then
      await waitFor(() =>
        expect(queryClient.getQueryState(MEMO_QUERY_KEYS.list())?.isInvalidated).toBe(true),
      );
      expect(queryClient.getQueryState(MEMO_QUERY_KEYS.resourceLimit())?.isInvalidated).toBe(true);
    });

    it('메모로 저장에 실패하면 저장한 것으로 바뀌지 않고 같은 키로 다시 저장할 수 있다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient, di } = await renderVoiceNote({
        digest: createVoiceNoteDigest({ keyPoints: [] }),
        planDraft: emptyPlanDraft,
      });
      httpClient.post.mockRejectedValue(new NetworkError());

      // When
      await user.press(await screen.findByRole('button', { name: '메모로 저장' }));

      // Then
      expect(await screen.findByRole('button', { name: '메모로 저장' })).toBeEnabled();
      const kept = di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID);
      expect(kept?.memoSavedAt).toBeNull();
      expect(kept?.digest).not.toBeNull();
      expect(kept?.memoSaveRequest?.idempotencyKey).toBe(
        httpClient.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key'],
      );
    });

    it('삭제를 확인하면 기기에서 지우고 화면을 닫는다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { di } = await renderVoiceNote({
        digest: createVoiceNoteDigest({ keyPoints: [] }),
        planDraft: emptyPlanDraft,
      });

      // When
      await user.press(await screen.findByText('이 메모 삭제'));
      await screen.findByText('이 메모를 삭제할까요?');
      await user.press(screen.getByRole('button', { name: '삭제' }));

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)).toBeNull();
    });

    it('녹음을 지운 메모는 글자와 요약이 남고 다시 들을 수 없다고 알린다', async () => {
      // Given
      const digest = createVoiceNoteDigest({ summary: '남아 있는 요약', keyPoints: [] });

      // When
      await renderVoiceNote({ digest, planDraft: emptyPlanDraft, recordings: [] });

      // Then
      expect(await screen.findByText('남아 있는 요약')).toBeOnTheScreen();
      expect(screen.getByText('녹음 파일이 없어서 다시 들을 수 없어요')).toBeOnTheScreen();
    });

    it('이미 할 일을 추가한 메모는 할 일 탭에서 다시 추가하지 않게 안내한다', async () => {
      // Given
      const appliedAt = toInstant('2026-11-02T00:00:00.000Z');

      // When
      await renderVoiceNote(
        { digest: createVoiceNoteDigest(), planDraft: null, appliedAt },
        'todos',
      );

      // Then
      expect(await screen.findByTestId('voice-note-applied')).toHaveTextContent(
        '할 일을 추가했어요',
      );
    });

    it('할 일을 추가한 메모는 할 일 탭이 추가한 수를 세고 몇 개를 추가했는지 알린다', async () => {
      // Given
      stubWindowDimensions(390);
      const appliedAt = toInstant('2026-11-02T00:00:00.000Z');

      // When
      await renderVoiceNote(
        { digest: createVoiceNoteDigest(), planDraft: null, appliedAt, appliedTodoCount: 2 },
        'todos',
      );

      // Then
      expect(await screen.findByTestId('voice-note-applied')).toHaveTextContent(
        '할 일 2개를 추가했어요',
      );
      expect(screen.getByText('할 일 2')).toBeOnTheScreen();
    });

    it('할 일 저장을 누르고 화면을 떠나도 응답이 오면 저장했다고 초안에 남긴다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient, di, unmount } = await renderVoiceNote(
        { digest: createVoiceNoteDigest(), planDraft: planDraftWithTodo },
        'todos',
      );
      const saved = createPendingResponse(ok({ todos: [], memo: null }));
      httpClient.post.mockReturnValue(saved.response);
      expect(await screen.findByRole('button', { name: /^할 일 \d+개 추가$/ })).toBeEnabled();
      await user.press(screen.getByRole('button', { name: /^할 일 \d+개 추가$/ }));
      await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));

      // When
      await act(async () => unmount());
      await act(async () => saved.settle());

      // Then
      await waitFor(() =>
        expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.appliedAt).not.toBeNull(),
      );
    });

    it('할 일 저장 응답을 놓치고 다시 열어 눌러도 같은 키로 보낸다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient, di, unmount } = await renderVoiceNote(
        { digest: createVoiceNoteDigest(), planDraft: planDraftWithTodo },
        'todos',
      );
      httpClient.post.mockRejectedValue(new NetworkError());
      expect(await screen.findByRole('button', { name: /^할 일 \d+개 추가$/ })).toBeEnabled();
      await user.press(screen.getByRole('button', { name: /^할 일 \d+개 추가$/ }));
      await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
      const firstKey = httpClient.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key'];
      expect(await screen.findByRole('button', { name: /^할 일 \d+개 추가$/ })).toBeEnabled();

      // When
      await act(async () => unmount());
      const reopened = di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID);

      // Then
      expect(reopened?.planApplyRequest?.idempotencyKey).toBe(firstKey);
    });

    it('메모로 저장을 누르고 화면을 떠나도 응답이 오면 저장했다고 초안에 남기고 키를 지운다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient, di, unmount } = await renderVoiceNote({
        digest: createVoiceNoteDigest({ keyPoints: [] }),
        planDraft: emptyPlanDraft,
      });
      const saved = createPendingResponse(ok({ todos: [], memo: null }));
      httpClient.post.mockReturnValue(saved.response);
      await user.press(await screen.findByRole('button', { name: '메모로 저장' }));
      await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
      expect(
        di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.memoSaveRequest?.idempotencyKey,
      ).toBe(httpClient.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key']);

      // When
      await act(async () => unmount());
      await act(async () => saved.settle());

      // Then
      await waitFor(() =>
        expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.memoSavedAt).not.toBeNull(),
      );
      expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.memoSaveRequest).toBeNull();
    });

    it('응답을 놓친 뒤 메모로 저장을 다시 누르면 같은 키로 다시 보낸다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient } = await renderVoiceNote({
        digest: createVoiceNoteDigest({ keyPoints: [] }),
        planDraft: emptyPlanDraft,
      });
      httpClient.post.mockRejectedValue(new NetworkError());
      await user.press(await screen.findByRole('button', { name: '메모로 저장' }));
      await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
      await act(async () => {});

      // When
      await user.press(await screen.findByRole('button', { name: '메모로 저장' }));

      // Then
      await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(2));
      expect(httpClient.post.mock.calls[1]?.[2]?.headers?.['Idempotency-Key']).toBe(
        httpClient.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key'],
      );
    });

    it('서버가 같은 키로 다른 내용이라고 거절하면 저장해 둔 키를 지운다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { httpClient, di } = await renderVoiceNote({
        digest: createVoiceNoteDigest({ keyPoints: [] }),
        planDraft: emptyPlanDraft,
      });
      httpClient.post.mockResolvedValue(
        fail(createApiError('AI_1318', { message: '키 충돌', status: 409 })),
      );

      // When
      await user.press(await screen.findByRole('button', { name: '메모로 저장' }));

      // Then
      await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.memoSaveRequest).toBeNull(),
      );
    });
  });

  describe('정리 요청', () => {
    setupFakeTimersPerTest({ advanceTimers: true });

    it('들은 문장을 구간과 함께 보내고 받은 요약·핵심·할 일 카드를 초안에 담아 이벤트를 한 번 보낸다', async () => {
      // Given
      const { httpClient, di, analytics } = await renderVoiceNote({});
      httpClient.post.mockResolvedValue(
        ok(
          createVoiceNoteDigestDto({
            plan: {
              actions: [
                {
                  type: 'CREATE_TODO',
                  key: 'a1',
                  title: '시안 만들기',
                  startDate: '2026-11-05',
                  endDate: null,
                  scheduledTime: null,
                  repeat: null,
                  visibility: null,
                  items: [],
                  categoryId: null,
                  duplicateOfTodoId: null,
                },
              ],
              omittedTodoCount: 0,
            },
          }),
        ),
      );

      // When
      await fireEvent.press(await screen.findByRole('button', { name: '정리하기' }));

      // Then
      expect(await screen.findByText('요약이에요')).toBeOnTheScreen();
      const [digest] = findPosts(httpClient, 'v1/voice-notes/digest');
      expect(digest?.[1]).toEqual({
        text: '이번 주 목표는 온보딩 이탈을 줄이는 거예요.',
        durationSeconds: 178,
        segments: [
          {
            startMs: 12_000,
            text: '이번 주 목표는 온보딩 이탈을 줄이는 거예요.',
            isBookmarked: false,
          },
        ],
      });
      const saved = di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID);
      expect(saved?.digest?.title).toBe('온보딩 회의');
      expect(saved?.digest?.keyPoints).toHaveLength(1);
      expect(saved?.planDraft?.form.actions.map((action) => action.title)).toEqual(['시안 만들기']);
      expect(saved?.digestRequest).toBeNull();
      expect(getTrackedEvents(analytics, 'voice_plan_generated')).toHaveLength(1);
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'voice_plan_generated',
        expect.objectContaining({ source: 'voice_note', todo_count: 1, charged: true }),
      );
    });
  });

  describe('할 일 고르기와 저장', () => {
    setupFakeTimersPerTest({ advanceTimers: true });

    async function renderTodosTab() {
      const rendered = await renderVoiceNote(
        { digest: createVoiceNoteDigest(), planDraft: planDraftWithThreeTodos },
        'todos',
      );
      await screen.findByTestId('plan-review-apply');

      return rendered;
    }

    function getApplyKeys(httpClient: ReturnType<typeof createHttpClientStub>) {
      return findPosts(httpClient, 'v1/action-plans/apply').map(
        ([, , config]) => config?.headers?.['Idempotency-Key'],
      );
    }

    it('고른 카드를 묶어 보인 순서로 저장하고 추가한 수를 초안에 남겨 이벤트를 한 번 보낸다', async () => {
      // Given
      const { httpClient, di, analytics } = await renderTodosTab();
      httpClient.post.mockResolvedValue(
        ok({
          todos: [
            createTodoDto({ id: 1, title: '운동' }),
            createTodoDto({ id: 2, title: '장보기' }),
            createTodoDto({ id: 3, title: '회의' }),
          ],
          memo: null,
        }),
      );

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));

      // Then
      expect(await screen.findByTestId('voice-note-applied')).toHaveTextContent(
        '할 일 3개를 추가했어요',
      );
      const applied = findPosts(httpClient, 'v1/action-plans/apply');
      expect(applied).toHaveLength(1);
      expect(applied[0]?.[1]).toEqual({
        source: 'VOICE_NOTE',
        actions: [
          expect.objectContaining({ key: 'todo-1', title: '운동', categoryId: 1 }),
          expect.objectContaining({ key: 'todo-3', title: '장보기', categoryId: 1 }),
          expect.objectContaining({ key: 'todo-2', title: '회의', categoryId: 2 }),
        ],
      });
      expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.appliedAt).not.toBeNull();
      expect(getTrackedEvents(analytics, 'voice_plan_applied')).toHaveLength(1);
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_plan_applied', {
        source: 'voice_note',
        todo_count: 3,
        memo_count: 0,
        skipped_count: 0,
      });
    });

    it('체크를 끄고 제목을 고친 카드는 뺀 채 고친 제목으로 보내고 고른 상태는 초안에 남는다', async () => {
      // Given
      const { httpClient, di } = await renderTodosTab();
      httpClient.post.mockRejectedValue(new NetworkError());
      await fireEvent.press(screen.getByLabelText('회의 추가하기'));
      await fireEvent.press(screen.getByText('운동'));
      await fireEvent.changeText(await screen.findByLabelText('할 일 제목'), '아침 운동');
      await fireEvent.press(screen.getByTestId('plan-todo-edit-confirm'));
      expect(await screen.findByText('아침 운동')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByRole('button', { name: '할 일 2개 추가' }));

      // Then
      await waitFor(() => expect(findPosts(httpClient, 'v1/action-plans/apply')).toHaveLength(1));
      expect(findPosts(httpClient, 'v1/action-plans/apply')[0]?.[1]).toEqual({
        source: 'VOICE_NOTE',
        actions: [
          expect.objectContaining({ key: 'todo-1', title: '아침 운동' }),
          expect.objectContaining({ key: 'todo-3', title: '장보기' }),
        ],
      });
      await act(() => jest.advanceTimersByTimeAsync(2_000));
      const kept = di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID);
      expect(
        kept?.planDraft?.form.actions.map(({ title, isSelected }) => ({ title, isSelected })),
      ).toEqual([
        { title: '아침 운동', isSelected: true },
        { title: '회의', isSelected: false },
        { title: '장보기', isSelected: true },
      ]);
    });

    it('저장에 실패한 뒤 같은 카드로 다시 누르면 같은 키로 보내고 고쳐서 누르면 새 키로 보낸다', async () => {
      // Given
      const { httpClient } = await renderTodosTab();
      httpClient.post.mockRejectedValue(new NetworkError());
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await waitFor(() => expect(getApplyKeys(httpClient)).toHaveLength(1));
      await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());
      // 저장 버튼의 연타 가드(600ms)가 지난 뒤에 다시 누른다
      await act(() => jest.advanceTimersByTimeAsync(600));

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await waitFor(() => expect(getApplyKeys(httpClient)).toHaveLength(2));
      await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());
      await fireEvent.press(screen.getByLabelText('회의 추가하기'));
      await act(() => jest.advanceTimersByTimeAsync(600));
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await waitFor(() => expect(getApplyKeys(httpClient)).toHaveLength(3));

      // Then
      const keys = getApplyKeys(httpClient);
      expect(keys[1]).toBe(keys[0]);
      expect(keys[2]).not.toBe(keys[0]);
    });

    it('할 일 추가를 같은 프레임에 두 번 눌러도 저장 요청과 저장 이벤트는 한 번이다', async () => {
      // Given
      const { httpClient, analytics } = await renderTodosTab();
      const saved = createPendingResponse(ok({ todos: [], memo: null }));
      httpClient.post.mockReturnValue(saved.response);
      const apply = screen.getByTestId('plan-review-apply');

      // When
      await act(async () => {
        await fireEvent.press(apply);
        await fireEvent.press(apply);
      });

      // Then
      expect(getApplyKeys(httpClient)).toHaveLength(1);

      // When
      await act(async () => saved.settle());
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(getTrackedEvents(analytics, 'voice_plan_applied')).toHaveLength(1);
      expect(getApplyKeys(httpClient)).toHaveLength(1);
    });

    it('메모로 저장을 같은 프레임에 두 번 눌러도 저장 요청은 한 번이다', async () => {
      // Given
      const { httpClient } = await renderVoiceNote({
        digest: createVoiceNoteDigest({ keyPoints: [] }),
        planDraft: emptyPlanDraft,
      });
      const saved = createPendingResponse(ok({ todos: [], memo: null }));
      httpClient.post.mockReturnValue(saved.response);
      const saveMemo = await screen.findByRole('button', { name: '메모로 저장' });

      // When
      await act(async () => {
        await fireEvent.press(saveMemo);
        await fireEvent.press(saveMemo);
      });

      // Then
      expect(getApplyKeys(httpClient)).toHaveLength(1);
      await act(async () => saved.settle());
    });
  });

  describe('조회와 다시 그리기', () => {
    setupFakeTimersPerTest();

    // 결과 화면 맨 위만 재생을 멈추려고 화면 떠남을 구독해, 그 호출 수가 맨 위가 그려진 횟수다
    function countScreenRenders() {
      return jest.mocked(useIsFocused).mock.calls.length;
    }

    it('캐시에 있는 값으로 열면 서버에 다시 묻지 않는다', async () => {
      // When
      const { httpClient } = await renderVoiceNote(
        { digest: createVoiceNoteDigest(), planDraft: planDraftWithThreeTodos },
        'todos',
      );
      await screen.findByTestId('plan-review-apply');

      // Then
      expect(httpClient.get).not.toHaveBeenCalled();
    });

    it('카드의 체크를 바꿔도 결과 화면 맨 위는 다시 그려지지 않는다', async () => {
      // Given
      await renderVoiceNote(
        { digest: createVoiceNoteDigest(), planDraft: planDraftWithThreeTodos },
        'todos',
      );
      const checkbox = await screen.findByLabelText('회의 추가하기');
      const renderCountBeforeToggle = countScreenRenders();

      // When
      await fireEvent.press(checkbox);
      await fireEvent.press(checkbox);
      await fireEvent.press(checkbox);

      // Then
      expect(screen.getByRole('button', { name: '할 일 2개 추가' })).toBeOnTheScreen();
      expect(countScreenRenders()).toBe(renderCountBeforeToggle);
    });
  });
});
