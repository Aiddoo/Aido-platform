import '@src/shared/i18n/init';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.factories';
import { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/constants/entitlement-query-keys';
import { createActivationProgressRepository } from '@src/features/device/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/device/activation/apis/activation.service';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { AuthService } from '@src/features/identity/auth/apis/auth.service';
import { PreferenceService } from '@src/features/identity/preference/apis/preference.service';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/constants/preference-query-keys';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { TodoCategoryService } from '@src/features/planning/category/apis/todo-category.service';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/constants/todo-category-query-keys';
import {
  createErrorReporterStub,
  createHapticsStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
  createMockStorage,
  createMockTokenStore,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { NetworkError } from '@src/shared/errors';
import { ApiError } from '@src/shared/errors/api-error';
import { err, ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import VoiceNoteRoute from '../../../../app/(app)/voice-notes/[draftId]';
import { VoiceService } from '../apis/voice.service';
import { createPlanReviewDraft } from '../domains/plan-review-form.schema';
import { voicePlanSchema } from '../domains/voice-plan.model';
import { createVoiceNoteDigest, createVoiceNoteFixture } from './voice-note.factories';

// AuthService가 읽는 앱 설정(ENV)은 불러올 때 expo extra를 검사해서, 기존 인증 테스트처럼 설정 모듈만 대체한다

const ACCOUNT_ID = 'user-1';
const DRAFT_ID = 'draft-1';
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

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

const createDigestDto = () => ({
  title: '온보딩 회의',
  summary: '요약이에요',
  keyPoints: [],
  plan: { actions: [], omittedTodoCount: 0 },
  featureQuota: null,
  charged: true,
});

async function renderScreen(note: Parameters<typeof createVoiceNoteFixture>[0], tab?: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ draftId: DRAFT_ID, tab });
  const httpClient = createMockHttpClient();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const storage = createVoiceNoteStorageServiceFake();
  storage.drafts.save(ACCOUNT_ID, createVoiceNoteFixture({ draftId: DRAFT_ID, ...note }));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: ACCOUNT_ID });
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), createEntitlementSnapshot());
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [{ id: 1, name: '기본', color: '#3B82F6', sortOrder: 0, todoCount: 0 }],
  });
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), { timeFormat: 'H12' });

  const { unmount } = await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <VoiceNoteRoute />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        voiceService: new VoiceService(httpClient, logger),
        activationService: new ActivationService(
          createActivationProgressRepository(createMemorySyncStorage()),
        ),
        entitlementService: new EntitlementService(httpClient, logger),
        userService: new UserService(httpClient),
        todoCategoryService: new TodoCategoryService(httpClient),
        preferenceService: new PreferenceService(httpClient),
        authService: new AuthService(httpClient, httpClient, createMockTokenStore()),
        coachmarkService: new CoachmarkService({ isSeen: () => true, markSeen: jest.fn() }),
        storage: createMockStorage(),
        voiceNoteStorageService: storage,
        analytics: createMockAnalytics(),
        errorReporter: createErrorReporterStub(),
        haptics: createHapticsStub(),
        logger,
      },
    },
  );

  return { httpClient, storage, unmount };
}

describe('말로 메모 화면', () => {
  test('정리 전에는 들은 글자와 정리하기, 쓰게 될 횟수를 보여 준다', async () => {
    // Given
    await renderScreen({});

    // When
    const button = await screen.findByText('정리하기');

    // Then
    expect(button).toBeTruthy();
    expect(screen.getByTestId('voice-note-digest-cost')).toHaveTextContent(
      '1번 사용 · 이번 달 3번 남음',
    );
  });

  test('정리에 실패하면 글자를 남기고 차감되지 않았을 때만 그렇게 말하며 다시 정리를 보인다', async () => {
    // Given
    const { httpClient } = await renderScreen({});
    httpClient.post.mockResolvedValue(
      err(new ApiError('AI_1301', '실패', 503, { charged: false })),
    );

    // When
    await fireEvent.press(await screen.findByText('정리하기'));

    // Then
    expect(await screen.findByText('다시 정리')).toBeTruthy();
    expect(screen.getByTestId('voice-note-digest-failure')).toHaveTextContent(
      /횟수는 차감되지 않았어요/,
    );
  });

  test('연결이 안 돼 정리하지 못하면 연결되면 다시 정리할 수 있다고 알린다', async () => {
    // Given
    const { httpClient } = await renderScreen({});
    httpClient.post.mockRejectedValue(new NetworkError());

    // When
    await fireEvent.press(await screen.findByText('정리하기'));

    // Then
    const failure = await screen.findByTestId('voice-note-digest-failure');
    expect(failure).toHaveTextContent(/인터넷에 연결되지 않았어요/);
    expect(failure).toHaveTextContent(/인터넷에 연결되면 다시 정리할 수 있어요/);
    expect(screen.getByText('다시 정리')).toBeTruthy();
  });

  test('너무 길어 정리하지 못하면 이유를 알리고 소용없는 다시 정리를 보이지 않는다', async () => {
    // Given
    const { httpClient } = await renderScreen({});
    httpClient.post.mockResolvedValue(err(new ApiError('AI_1312', '너무 김', 422)));

    // When
    await fireEvent.press(await screen.findByText('정리하기'));

    // Then
    expect(await screen.findByTestId('voice-note-digest-failure')).toHaveTextContent(
      /한 번에 정리할 수 있는 길이를 넘었어요/,
    );
    expect(screen.queryByText('다시 정리')).toBeNull();
    expect(screen.getByLabelText('더 보기')).toBeTruthy();
  });

  test('정리가 끝나면 결과로 바뀌고 할 일이 없으면 요약을 남겼다고 알린다', async () => {
    // Given
    const { httpClient } = await renderScreen({});
    httpClient.post.mockResolvedValue(ok(createDigestDto()));

    // When
    await fireEvent.press(await screen.findByText('정리하기'));

    // Then
    expect(await screen.findByText('요약이에요')).toBeTruthy();
    expect(screen.getByTestId('voice-note-no-todos')).toHaveTextContent(
      '할 일로 나눌 내용은 없었어요. 요약을 남겨뒀어요.',
    );
  });

  test('메모로 저장하면 요약을 메모로 보내고 저장했다고 바뀐다', async () => {
    // Given
    const { httpClient } = await renderScreen({
      digest: createVoiceNoteDigest({ keyPoints: [] }),
      planDraft: emptyPlanDraft,
    });
    httpClient.post.mockResolvedValue(ok({ todos: [], memo: null }));

    // When
    await fireEvent.press(await screen.findByLabelText('메모로 저장'));

    // Then
    await waitFor(() => expect(screen.getByLabelText('메모로 저장했어요')).toBeDisabled());
    expect(httpClient.post.mock.calls[0]?.[0]).toBe('v1/action-plans/apply');
  });

  test('삭제를 확인하면 기기에서 지우고 화면을 닫는다', async () => {
    // Given
    const { storage } = await renderScreen({
      digest: createVoiceNoteDigest({ keyPoints: [] }),
      planDraft: emptyPlanDraft,
    });

    // When
    await act(async () => {
      fireEvent.press(await screen.findByText('이 메모 삭제')).catch(jest.fn());
    });
    await screen.findByText('이 메모를 삭제할까요?');
    await fireEvent.press(screen.getByText('삭제'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)).toBeUndefined();
  });

  test('녹음을 지운 메모는 글자와 요약이 남고 다시 들을 수 없다고 알린다', async () => {
    // Given
    const digest = createVoiceNoteDigest({ summary: '남아 있는 요약', keyPoints: [] });

    // When
    await renderScreen({ digest, planDraft: emptyPlanDraft, recordings: [] });

    // Then
    expect(await screen.findByText('남아 있는 요약')).toBeTruthy();
    expect(screen.getByText('녹음 파일이 없어서 다시 들을 수 없어요')).toBeTruthy();
  });

  test('이미 할 일을 추가한 메모는 할 일 탭에서 다시 추가하지 않게 안내한다', async () => {
    // Given
    const appliedAt = new Date('2026-11-02T00:00:00.000Z');

    // When
    await renderScreen({ digest: createVoiceNoteDigest(), planDraft: null, appliedAt }, 'todos');

    // Then
    expect(await screen.findByTestId('voice-note-applied')).toHaveTextContent('할 일을 추가했어요');
  });

  test('할 일 저장을 누르고 화면을 떠나도 응답이 오면 저장했다고 초안에 남긴다', async () => {
    // Given
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
    await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('plan-review-apply'));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));

    // When
    await act(async () => unmount());
    await act(async () => respond());

    // Then
    await waitFor(() =>
      expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.appliedAt).toBeInstanceOf(Date),
    );
  });

  test('할 일 저장 응답을 놓치고 다시 열어 눌러도 같은 키로 보낸다', async () => {
    // Given
    const { httpClient, storage, unmount } = await renderScreen(
      { digest: createVoiceNoteDigest(), planDraft: planDraftWithTodo },
      'todos',
    );
    httpClient.post.mockRejectedValue(new NetworkError());
    await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('plan-review-apply'));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    const firstKey = httpClient.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key'];
    await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());

    // When
    await act(async () => unmount());
    const reopened = storage.drafts.find(ACCOUNT_ID, DRAFT_ID);

    // Then
    expect(reopened?.planApplyRequest?.idempotencyKey).toBe(firstKey);
  });

  test('메모로 저장을 누르고 화면을 떠나도 응답이 오면 저장했다고 초안에 남기고 키를 지운다', async () => {
    // Given
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
    await fireEvent.press(await screen.findByLabelText('메모로 저장'));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.memoSaveRequest?.idempotencyKey).toBe(
      httpClient.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key'],
    );

    // When
    await act(async () => unmount());
    await act(async () => respond());

    // Then
    await waitFor(() =>
      expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.memoSavedAt).toBeInstanceOf(Date),
    );
    expect(storage.drafts.find(ACCOUNT_ID, DRAFT_ID)?.memoSaveRequest).toBeNull();
  });
});
