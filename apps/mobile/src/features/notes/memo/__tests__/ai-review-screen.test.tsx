import '@src/shared/i18n/init';
import { ok, type Result } from '@src/core/errors/result';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { createPlannedTodo } from '@src/features/voice/__tests__/voice.fixtures';
import { createPlanReviewDraft } from '@src/features/voice/domains/plan-review-draft.model';
import { type VoicePlan, voicePlanIdSchema } from '@src/features/voice/domains/voice-plan.model';
import { toEpochMs, toInstant } from '@src/shared/date/instant';
import { NetworkError } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
  createTestQueryClient,
  deliverQueryNotifications,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import AiReviewRoute from '../../../../../app/(app)/memo/[memoId]/ai-review';
import { createMemoPlanDraftKey } from '../utils/memo-plan-draft';
import { createMemoMutationResponseDto } from './memo.fixtures';

const MEMO_ID = 1;
const ACCOUNT_ID = createCurrentUserDto().userId;
const MEMO_UPDATED_AT = '2026-11-06T00:00:00.000Z';
const TIMEZONE = 'Asia/Seoul';

const WORKOUT = createPlannedTodo({ actionId: 'a1', title: '운동', categoryId: null });
const MEETING = createPlannedTodo({ actionId: 'a2', title: '회의', categoryId: 2 });
const GROCERIES = createPlannedTodo({ actionId: 'a3', title: '장보기', categoryId: null });

function createMemoPlan(...actions: VoicePlan['actions']): VoicePlan {
  return {
    planId: voicePlanIdSchema.parse(`memo-${MEMO_ID}`),
    source: 'memo',
    sourceMemoId: MEMO_ID,
    actions,
    omittedTodoCount: 0,
  };
}

function createAppliedDto(titles: string[]) {
  return {
    todos: titles.map((title, index) => createTodoDto({ id: index + 1, title })),
    memo: null,
  };
}

async function renderAiReview(plan: VoicePlan | null = createMemoPlan(WORKOUT, MEETING)) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ memoId: String(MEMO_ID) });
  const httpClient = createHttpClientStub();
  const memoDto = createMemoMutationResponseDto();
  const responses: Record<string, Result<unknown, never>> = {
    'v1/auth/me': ok(createCurrentUserDto()),
    'v1/auth/preference': ok(createPreferenceDto()),
    'v1/entitlements': ok(createEntitlementSnapshotDto()),
    'v1/todo-categories': ok(createTodoCategoryListDto()),
    [`v1/memos/${MEMO_ID}`]: ok({
      memo: { ...memoDto.memo, id: MEMO_ID, updatedAt: MEMO_UPDATED_AT },
    }),
  };
  httpClient.get.mockImplementation((path: string) => respondByPath(responses)(path));
  const queryClient = createTestQueryClient();
  const analytics = createAnalyticsStub();
  const di = createTestDi({ ports: { httpClient, queryClient, analytics } });
  const draftKey = createMemoPlanDraftKey({
    userId: ACCOUNT_ID,
    memoId: MEMO_ID,
    timezone: TIMEZONE,
  });
  if (plan != null) {
    di.draftService.save(draftKey, createPlanReviewDraft(plan), {
      sourceUpdatedAt: toEpochMs(toInstant(MEMO_UPDATED_AT)),
    });
  }

  await renderScreen(<AiReviewRoute />, { di, withLocalDate: true, withOverlay: true });
  if (plan != null) {
    await screen.findByTestId('plan-review-apply');
  }
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  await act(() => deliverQueryNotifications());

  return { httpClient, analytics, di, draftKey };
}

function findApplyPosts(httpClient: ReturnType<typeof createHttpClientStub>) {
  return httpClient.post.mock.calls.filter(([path]) => path === 'v1/action-plans/apply');
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, name: string) {
  return analytics.trackEvent.mock.calls.filter(([eventName]) => eventName === name).length;
}

describe('AiReviewScreen', () => {
  // 저장 뒤 토스트와 초안 자동 저장 타이머가 테스트 밖에 남지 않게 한다
  setupFakeTimersPerTest({ advanceTimers: true });

  describe('고르고 저장하기', () => {
    it('고른 카드를 원본 메모와 함께 저장하고 초안을 지운 뒤 피드로 간다', async () => {
      // Given
      const { httpClient, analytics, di, draftKey } = await renderAiReview();
      httpClient.post.mockResolvedValue(ok(createAppliedDto(['운동', '회의'])));

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));

      // Then
      await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/feed'));
      expect(findApplyPosts(httpClient)).toHaveLength(1);
      expect(findApplyPosts(httpClient)[0]?.[1]).toEqual({
        source: 'MEMO',
        sourceMemoId: MEMO_ID,
        actions: [
          expect.objectContaining({ key: 'a1', title: '운동', categoryId: 1 }),
          expect.objectContaining({ key: 'a2', title: '회의', categoryId: 2 }),
        ],
      });
      expect(router.dismiss).toHaveBeenCalledTimes(1);
      expect(di.draftService.restore(draftKey).status).not.toBe('restored');
      expect(countEvents(analytics, 'voice_plan_applied')).toBe(1);
      expect(countEvents(analytics, 'memo_converted_to_todos')).toBe(1);
    });

    it('체크를 끈 카드는 보내지 않고 건너뛴 수로 남긴다', async () => {
      // Given
      const { httpClient, analytics } = await renderAiReview();
      httpClient.post.mockResolvedValue(ok(createAppliedDto(['회의'])));
      await fireEvent.press(screen.getByLabelText('운동 추가하기'));

      // When
      await fireEvent.press(screen.getByRole('button', { name: '할 일 1개 추가' }));

      // Then
      await waitFor(() => expect(findApplyPosts(httpClient)).toHaveLength(1));
      expect(findApplyPosts(httpClient)[0]?.[1]).toEqual({
        source: 'MEMO',
        sourceMemoId: MEMO_ID,
        actions: [expect.objectContaining({ key: 'a2', title: '회의' })],
      });
      await waitFor(() =>
        expect(analytics.trackEvent).toHaveBeenCalledWith(
          'voice_plan_applied',
          expect.objectContaining({ source: 'memo', todo_count: 1, skipped_count: 1 }),
        ),
      );
    });

    it('카드를 눌러 제목을 고치면 고친 제목으로 보내고 고친 값은 초안에 남는다', async () => {
      // Given
      const { httpClient, di, draftKey } = await renderAiReview();
      httpClient.post.mockRejectedValue(new NetworkError());
      await fireEvent.press(screen.getByText('운동'));
      await fireEvent.changeText(await screen.findByLabelText('할 일 제목'), '아침 운동');
      await fireEvent.press(screen.getByTestId('plan-todo-edit-confirm'));
      expect(await screen.findByText('아침 운동')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));

      // Then
      await waitFor(() => expect(findApplyPosts(httpClient)).toHaveLength(1));
      expect(findApplyPosts(httpClient)[0]?.[1]).toEqual(
        expect.objectContaining({
          actions: [
            expect.objectContaining({ key: 'a1', title: '아침 운동' }),
            expect.objectContaining({ key: 'a2', title: '회의' }),
          ],
        }),
      );
      await act(() => jest.advanceTimersByTimeAsync(2_000));
      const restored = di.draftService.restore(draftKey);
      expect(restored.status).toBe('restored');
      expect(restored.status === 'restored' && restored.value.form.actions[0]?.title).toBe(
        '아침 운동',
      );
    });

    it('카테고리가 나뉘어 온 카드는 묶어 보인 순서로 보낸다', async () => {
      // Given
      const { httpClient } = await renderAiReview(createMemoPlan(WORKOUT, MEETING, GROCERIES));
      httpClient.post.mockResolvedValue(ok(createAppliedDto(['운동', '장보기', '회의'])));

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));

      // Then
      await waitFor(() => expect(findApplyPosts(httpClient)).toHaveLength(1));
      expect(findApplyPosts(httpClient)[0]?.[1]).toEqual(
        expect.objectContaining({
          actions: [
            expect.objectContaining({ key: 'a1', categoryId: 1 }),
            expect.objectContaining({ key: 'a3', categoryId: 1 }),
            expect.objectContaining({ key: 'a2', categoryId: 2 }),
          ],
        }),
      );
    });
  });

  describe('다시 보내기', () => {
    it('저장에 실패한 뒤 같은 카드로 다시 누르면 같은 키로 보내고 고쳐서 누르면 새 키로 보낸다', async () => {
      // Given
      const { httpClient } = await renderAiReview();
      httpClient.post.mockRejectedValue(new NetworkError());
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await waitFor(() => expect(findApplyPosts(httpClient)).toHaveLength(1));
      await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());
      // 저장 버튼의 연타 가드(600ms)가 지난 뒤에 다시 누른다
      await act(() => jest.advanceTimersByTimeAsync(600));

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await waitFor(() => expect(findApplyPosts(httpClient)).toHaveLength(2));
      await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());
      await fireEvent.press(screen.getByLabelText('운동 추가하기'));
      await act(() => jest.advanceTimersByTimeAsync(600));
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await waitFor(() => expect(findApplyPosts(httpClient)).toHaveLength(3));

      // Then
      const keys = findApplyPosts(httpClient).map(
        ([, , config]) => config?.headers?.['Idempotency-Key'],
      );
      expect(keys[1]).toBe(keys[0]);
      expect(keys[2]).not.toBe(keys[0]);
      expect(screen.getByText('회의')).toBeOnTheScreen();
    });

    it('추가를 같은 프레임에 두 번 눌러도 저장 요청과 저장 이벤트는 한 번이다', async () => {
      // Given
      const { httpClient, analytics } = await renderAiReview();
      const saved = createPendingResponse(ok(createAppliedDto(['운동', '회의'])));
      httpClient.post.mockReturnValue(saved.response);
      const apply = screen.getByTestId('plan-review-apply');

      // When
      await act(async () => {
        await fireEvent.press(apply);
        await fireEvent.press(apply);
      });

      // Then
      const keys = findApplyPosts(httpClient).map(
        ([, , config]) => config?.headers?.['Idempotency-Key'],
      );
      expect(keys).toHaveLength(1);

      // When
      await act(async () => saved.settle());
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(countEvents(analytics, 'voice_plan_applied')).toBe(1);
      expect(findApplyPosts(httpClient)).toHaveLength(1);
    });
  });

  describe('조회와 다시 그리기', () => {
    it('처음 열 때 같은 조회를 두 번 보내지 않는다', async () => {
      // When
      const { httpClient } = await renderAiReview();

      // Then
      expect(countGetRequests(httpClient)).toEqual({
        'v1/auth/me': 1,
        'v1/auth/preference': 1,
        'v1/todo-categories': 1,
        [`v1/memos/${MEMO_ID}`]: 1,
      });
    });

    it('나눈 내용이 기기에 없으면 알리고 돌아간다', async () => {
      // When
      await renderAiReview(null);

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId('plan-review-apply')).toBeNull();
    });
  });
});
