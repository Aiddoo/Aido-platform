import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
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
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createLoggerStub,
  createMemoryStorage,
  createVoiceNoteStorageFake,
  createTestQueryClient,
  renderUi,
  stubWindowDimensions,
} from '@src/shared/__tests__';
import { setupFakeTimersPerTest } from '@src/shared/__tests__/setup-fake-timers-per-test';
import { toInstant } from '@src/shared/date/instant';
import { NetworkError } from '@src/shared/errors';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import VoiceNoteRoute from '../../../../app/(app)/voice-notes/[draftId]';
import { voicePlanSchema } from '../domains/voice-plan.model';
import { createPlanReviewDraft } from '../utils/plan-review-draft';
import { createVoiceNoteDigest, createSpokenVoiceNote } from './voice-note.fixtures';
import { createVoiceNoteDigestDto } from './voice.fixtures';

const ACCOUNT_ID = 'user-1';
const DRAFT_ID = 'draft-1';
let logger: ReturnType<typeof createLoggerStub>;

beforeEach(() => {
  logger = createLoggerStub();
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

async function renderScreen(note: Parameters<typeof createSpokenVoiceNote>[0], tab?: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ draftId: DRAFT_ID, tab });
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const storage = createVoiceNoteStorageFake();
  storage.drafts.save(ACCOUNT_ID, createSpokenVoiceNote({ draftId: DRAFT_ID, ...note }));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), createEntitlementSnapshot());
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [{ id: 1, name: '기본', color: '#3B82F6', sortOrder: 0, todoCount: 0 }],
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    createPreference({ timeFormat: 'TWELVE_HOUR' }),
  );

  const { unmount } = await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <VoiceNoteRoute />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        httpClient,
        syncStorage: createAllSeenCoachmarkStorage(ACCOUNT_ID).syncStorage,
        storage: createMemoryStorage(),
        ...storage.di,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        haptics: createHapticsGatewayStub(),
        logger,
      },
    },
  );

  return { httpClient, storage, unmount, queryClient };
}

describe('말로 메모 화면', () => {
  // 화면을 떠난 뒤 오는 응답·동의 결과가 토스트를 띄워도 타이머가 테스트 밖에 남지 않게 한다
  setupFakeTimersPerTest({ advanceTimers: true });

  it('정리 전에는 들은 글자와 정리하기, 쓰게 될 횟수를 보여 준다', async () => {
    // Given
    await renderScreen({});

    // When
    const button = await screen.findByRole('button', { name: '정리하기' });

    // Then
    expect(button).toBeOnTheScreen();
    expect(screen.getByTestId('voice-note-digest-cost')).toHaveTextContent(
      '1회 사용 · 이번 달 3회 남음',
    );
  });

  it('정리에 실패하면 글자를 남기고 차감되지 않았을 때만 그렇게 말하며 다시 정리를 보인다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient } = await renderScreen({});
    httpClient.post.mockResolvedValue(
      err(new ApiError('AI_1301', '실패', 503, { charged: false })),
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
    const { httpClient } = await renderScreen({});
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
    const { httpClient } = await renderScreen({});
    httpClient.post.mockResolvedValue(err(new ApiError('AI_1312', '너무 김', 422)));

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
    const { httpClient } = await renderScreen({});
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
    const { httpClient } = await renderScreen({
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
    const { httpClient, queryClient } = await renderScreen({
      digest: createVoiceNoteDigest({ keyPoints: [] }),
      planDraft: emptyPlanDraft,
    });
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
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
      expect(invalidate).toHaveBeenCalledWith({ queryKey: MEMO_QUERY_KEYS.list() }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
  });

  it('메모로 저장에 실패하면 저장한 것으로 바뀌지 않고 같은 키로 다시 저장할 수 있다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient, storage } = await renderScreen({
      digest: createVoiceNoteDigest({ keyPoints: [] }),
      planDraft: emptyPlanDraft,
    });
    httpClient.post.mockRejectedValue(new NetworkError());

    // When
    await user.press(await screen.findByRole('button', { name: '메모로 저장' }));

    // Then
    expect(await screen.findByRole('button', { name: '메모로 저장' })).toBeEnabled();
    const kept = storage.drafts.find(ACCOUNT_ID, DRAFT_ID);
    expect(kept?.memoSavedAt).toBeNull();
    expect(kept?.digest).not.toBeNull();
    expect(kept?.memoSaveRequest?.idempotencyKey).toBe(
      httpClient.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key'],
    );
  });

  it('삭제를 확인하면 기기에서 지우고 화면을 닫는다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { storage } = await renderScreen({
      digest: createVoiceNoteDigest({ keyPoints: [] }),
      planDraft: emptyPlanDraft,
    });

    // When
    await user.press(await screen.findByText('이 메모 삭제'));
    await screen.findByText('이 메모를 삭제할까요?');
    await user.press(screen.getByRole('button', { name: '삭제' }));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)).toBeNull();
  });

  it('녹음을 지운 메모는 글자와 요약이 남고 다시 들을 수 없다고 알린다', async () => {
    // Given
    const digest = createVoiceNoteDigest({ summary: '남아 있는 요약', keyPoints: [] });

    // When
    await renderScreen({ digest, planDraft: emptyPlanDraft, recordings: [] });

    // Then
    expect(await screen.findByText('남아 있는 요약')).toBeOnTheScreen();
    expect(screen.getByText('녹음 파일이 없어서 다시 들을 수 없어요')).toBeOnTheScreen();
  });

  it('이미 할 일을 추가한 메모는 할 일 탭에서 다시 추가하지 않게 안내한다', async () => {
    // Given
    const appliedAt = toInstant('2026-11-02T00:00:00.000Z');

    // When
    await renderScreen({ digest: createVoiceNoteDigest(), planDraft: null, appliedAt }, 'todos');

    // Then
    expect(await screen.findByTestId('voice-note-applied')).toHaveTextContent('할 일을 추가했어요');
  });

  it('할 일을 추가한 메모는 할 일 탭이 추가한 수를 세고 몇 개를 추가했는지 알린다', async () => {
    // Given
    stubWindowDimensions(390);
    const appliedAt = toInstant('2026-11-02T00:00:00.000Z');

    // When
    await renderScreen(
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
    const { httpClient, storage, unmount } = await renderScreen(
      { digest: createVoiceNoteDigest(), planDraft: planDraftWithTodo },
      'todos',
    );
    let respond = () => {};
    httpClient.post.mockReturnValue(
      new Promise((resolve) => {
        respond = () => resolve(ok({ todos: [], memo: null }));
      }),
    );
    expect(await screen.findByRole('button', { name: /^할 일 \d+개 추가$/ })).toBeEnabled();
    await user.press(screen.getByRole('button', { name: /^할 일 \d+개 추가$/ }));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));

    // When
    await act(async () => unmount());
    await act(async () => respond());

    // Then
    await waitFor(() =>
      expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.appliedAt).not.toBeNull(),
    );
  });

  it('할 일 저장 응답을 놓치고 다시 열어 눌러도 같은 키로 보낸다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient, storage, unmount } = await renderScreen(
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
    const reopened = storage.drafts.find(ACCOUNT_ID, DRAFT_ID);

    // Then
    expect(reopened?.planApplyRequest?.idempotencyKey).toBe(firstKey);
  });

  it('메모로 저장을 누르고 화면을 떠나도 응답이 오면 저장했다고 초안에 남기고 키를 지운다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient, storage, unmount } = await renderScreen({
      digest: createVoiceNoteDigest({ keyPoints: [] }),
      planDraft: emptyPlanDraft,
    });
    let respond = () => {};
    httpClient.post.mockReturnValue(
      new Promise((resolve) => {
        respond = () => resolve(ok({ todos: [], memo: null }));
      }),
    );
    await user.press(await screen.findByRole('button', { name: '메모로 저장' }));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.memoSaveRequest?.idempotencyKey).toBe(
      httpClient.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key'],
    );

    // When
    await act(async () => unmount());
    await act(async () => respond());

    // Then
    await waitFor(() =>
      expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.memoSavedAt).not.toBeNull(),
    );
    expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.memoSaveRequest).toBeNull();
  });

  it('응답을 놓친 뒤 메모로 저장을 다시 누르면 같은 키로 다시 보낸다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient } = await renderScreen({
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
    const { httpClient, storage } = await renderScreen({
      digest: createVoiceNoteDigest({ keyPoints: [] }),
      planDraft: emptyPlanDraft,
    });
    httpClient.post.mockResolvedValue(err(new ApiError('AI_1318', '키 충돌', 409)));

    // When
    await user.press(await screen.findByRole('button', { name: '메모로 저장' }));

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.memoSaveRequest).toBeNull(),
    );
  });
});
