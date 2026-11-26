import { zodResolver } from '@hookform/resolvers/zod';
import { ok } from '@src/core/errors/result';
import '@src/shared/i18n/init';
import { createPreference } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/queries/todo-category-query-keys';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Suspense, useEffect } from 'react';
import { FormState, useForm, Watch } from 'react-hook-form';

import { createPlanReviewDraft } from '../domains/plan-review-draft.model';
import type { PlannedTodo } from '../domains/planned-action.model';
import { type VoicePlan, voicePlanIdSchema } from '../domains/voice-plan.model';
import { usePlanApply } from '../hooks/use-plan-apply';
import {
  type PlanReviewFormValues,
  planReviewFormSchema,
} from '../schemas/plan-review-form.schema';
import { PlanReview } from './plan-review';

const createTodoAction = (overrides: Partial<PlannedTodo>): PlannedTodo => ({
  type: 'create-todo',
  actionId: 'todo-1',
  title: '운동',
  startDate: createDateKey('2026-11-05'),
  endDate: null,
  scheduledTime: null,
  repeat: null,
  visibility: null,
  items: [],
  categoryId: 1,
  duplicateOfTodoId: null,
  ...overrides,
});

const GROCERIES = createTodoAction({ actionId: 'todo-2', title: '장보기' });
const BIWEEKLY = createTodoAction({
  repeat: { frequency: 'WEEKLY', interval: 2, weekdays: ['TUE'], end: { type: 'NEVER' } },
});

const PLAN: VoicePlan = {
  planId: voicePlanIdSchema.parse('plan-1'),
  source: 'quick-voice',
  sourceMemoId: null,
  omittedTodoCount: 0,
  actions: [BIWEEKLY, GROCERIES],
};

type PlanApplyRequestStore = Parameters<typeof usePlanApply>[0]['requestStore'];

function PlanReviewScreen({
  plan = PLAN,
  isCharged,
  onValues,
  requestStore,
}: {
  plan?: VoicePlan;
  isCharged?: boolean;
  onValues?: (values: PlanReviewFormValues) => void;
  requestStore?: PlanApplyRequestStore;
}) {
  const form = useForm<PlanReviewFormValues>({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: createPlanReviewDraft(plan).form,
    mode: 'onChange',
  });
  const planApply = usePlanApply({
    plan,
    fallbackCategoryId: 1,
    requestStore,
    onMemoChanged: jest.fn(),
    onApplied: jest.fn(),
  });
  useEffect(() => {
    if (onValues == null) {
      return;
    }
    return form.subscribe({
      formState: { values: true },
      callback: ({ values }) => onValues(values),
    });
  }, [form, onValues]);

  // 폼을 가진 화면처럼 카드 칸을 Watch로 잇고 고친 카드는 그 자리만 쓰며 저장은 handleSubmit으로 보낸다
  const savePlan = form.handleSubmit(({ actions }) => planApply.apply(actions));

  return (
    <FormState
      control={form.control}
      render={({ isValid }) => (
        <Watch
          control={form.control}
          name="actions"
          render={(actions) => (
            <PlanReview
              value={actions}
              onItemChange={(index, action) =>
                form.setValue(`actions.${index}`, action, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              plan={plan}
              isCharged={isCharged}
              fallbackCategoryId={1}
              isValid={isValid}
              isApplying={planApply.isPending || planApply.isApplied}
              onApplyPress={() => {
                savePlan().catch(jest.fn());
              }}
            />
          )}
        />
      )}
    />
  );
}

async function renderPlan(
  plan?: VoicePlan,
  isCharged?: boolean,
  onValues?: (values: PlanReviewFormValues) => void,
  httpClient: ReturnType<typeof createHttpClientStub> = createHttpClientStub(),
  requestStore?: PlanApplyRequestStore,
) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [
      { id: 1, name: '기본', color: '#3B82F6', sortOrder: 0, todoCount: 2 },
      { id: 2, name: '중요한 일', color: '#EF4444', sortOrder: 1, todoCount: 0 },
    ],
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    createPreference({ timeFormat: 'TWELVE_HOUR' }),
  );

  await renderScreen(
    <Suspense fallback={null}>
      <PlanReviewScreen
        plan={plan}
        isCharged={isCharged}
        onValues={onValues}
        requestStore={requestStore}
      />
    </Suspense>,
    {
      di: createTestDi({ ports: { httpClient, queryClient } }),
      withLocalDate: true,
      withOverlay: true,
    },
  );
}

describe('PlanReview', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('할 일이 전부 이미 있으면 메모로 정리했다고 말하지 않고 버튼도 메모 저장이 아니다', async () => {
    // Given
    const plan = { ...PLAN, actions: [createTodoAction({ duplicateOfTodoId: 9 })] };

    // When
    await renderPlan(plan);

    // Then
    expect(await screen.findByText('이미 있는 할 일이에요')).toBeTruthy();
    expect(screen.queryByText('메모로 정리했어요')).toBeNull();
    expect(screen.getByText('할 일 추가')).toBeTruthy();
    expect(screen.queryByText('메모 저장')).toBeNull();
  });

  it('체크를 끄면 추가할 개수가 줄어들고 고치는 시트는 열리지 않는다', async () => {
    // Given
    await renderPlan();

    // When
    await fireEvent.press(await screen.findByLabelText('장보기 추가하기'));

    // Then
    await waitFor(() => expect(screen.getByText('할 일 1개 추가')).toBeTruthy());
    expect(screen.queryByLabelText('할 일 제목')).toBeNull();
  });

  it('할 일 카드를 누르면 그 할 일을 고치는 시트가 열린다', async () => {
    // Given
    await renderPlan();

    // When
    await fireEvent.press(await screen.findByRole('button', { name: /장보기/ }));

    // Then
    expect(await screen.findByDisplayValue('장보기')).toBeTruthy();
  });

  describe('같은 카테고리가 나뉘어 온 계획', () => {
    const SPLIT_PLAN: VoicePlan = {
      ...PLAN,
      actions: [
        createTodoAction({ actionId: 'a', title: '장보기', categoryId: 1 }),
        createTodoAction({ actionId: 'b', title: '세금 신고', categoryId: 2 }),
        createTodoAction({ actionId: 'c', title: '운동', categoryId: 1 }),
      ],
    };

    it('카테고리 머리글을 한 번씩만 보이고 카드를 그 아래로 모은다', async () => {
      // When
      await renderPlan(SPLIT_PLAN);

      // Then
      expect(await screen.findAllByText('기본')).toHaveLength(1);
      expect(screen.getAllByText('중요한 일')).toHaveLength(1);
      expect(screen.getAllByText(/장보기|세금 신고|운동/).map((row) => row.props.children)).toEqual(
        ['장보기', '운동', '세금 신고'],
      );
    });

    it('모아 보여도 고친 값은 그 카드의 자리에 들어간다', async () => {
      // Given
      const onValues = jest.fn();
      await renderPlan(SPLIT_PLAN, true, onValues);
      await fireEvent.press(await screen.findByText('운동'));
      await fireEvent.changeText(await screen.findByLabelText('할 일 제목'), '달리기');
      await waitFor(() => expect(screen.getByTestId('plan-todo-edit-confirm')).toBeEnabled());

      // When
      await fireEvent.press(screen.getByTestId('plan-todo-edit-confirm'));

      // Then
      await waitFor(() =>
        expect(
          onValues.mock.lastCall?.[0].actions.map(
            ({ actionId, title }: { actionId: string; title: string }) => [actionId, title],
          ),
        ).toEqual([
          ['a', '장보기'],
          ['b', '세금 신고'],
          ['c', '달리기'],
        ]),
      );
    });

    it('저장은 묶어 보인 순서대로 보낸다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      await renderPlan(SPLIT_PLAN, true, undefined, httpClient);
      await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));

      // Then
      await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
      expect(httpClient.post.mock.lastCall?.[1]).toMatchObject({
        actions: [{ title: '장보기' }, { title: '운동' }, { title: '세금 신고' }],
      });
    });
  });

  describe('추가 뒤 떠나는 동안', () => {
    setupFakeTimersPerTest();

    it('추가를 마쳐 시트가 내려가는 동안 다시 눌러도 할 일은 한 번만 추가한다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      httpClient.post.mockResolvedValue(
        ok({ todos: [createTodoDto({ id: 9, title: '장보기' })], memo: null }),
      );
      await renderPlan(PLAN, true, undefined, httpClient);
      await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      // 성공해 onApplied가 시트를 닫기 시작한 뒤다. 카드와 버튼은 닫힘 애니메이션이 끝날 때까지 남는다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it('응답을 기다리는 동안 다시 눌러도 할 일은 한 번만 추가한다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      const saved = createPendingResponse(
        ok({ todos: [createTodoDto({ id: 9, title: '장보기' })], memo: null }),
      );
      httpClient.post.mockReturnValue(saved.response);
      await renderPlan(PLAN, true, undefined, httpClient);
      await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      // 연타 가드(600ms)가 지난 뒤다. 응답은 아직 오지 않았다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(1);
      await act(async () => saved.settle());
    });

    it('저장 준비 단계가 던져도 다시 누르면 저장된다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      httpClient.post.mockResolvedValue(
        ok({ todos: [createTodoDto({ id: 9, title: '장보기' })], memo: null }),
      );
      // 저장 요청의 키를 기기에 남기다 한 번 실패한다(저장 공간 부족 등)
      const requestStore = {
        find: jest.fn<null, []>(() => null),
        save: jest.fn<void, [unknown]>().mockImplementationOnce(() => {
          throw new Error('storage full');
        }),
      };
      await renderPlan(PLAN, true, undefined, httpClient, requestStore);
      await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeEnabled());
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(httpClient.post).not.toHaveBeenCalled();

      // When
      await fireEvent.press(screen.getByTestId('plan-review-apply'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });
  });

  it('제목이 비어 저장할 수 없는 카드가 있으면 추가 버튼을 막는다', async () => {
    // When
    await renderPlan({
      ...PLAN,
      actions: [createTodoAction({ title: '' }), GROCERIES],
    });

    // Then
    await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeDisabled());
  });

  it('성공 응답의 charged가 false여도 카드가 있으면 차감 문구를 보이지 않는다', async () => {
    // Given
    const isCharged = false;

    // When
    await renderPlan(PLAN, isCharged);

    // Then
    expect(await screen.findByText('장보기')).toBeTruthy();
    expect(screen.queryByText('횟수는 차감되지 않았어요')).toBeNull();
  });

  it('카드 제목을 지워도 확인 전에는 폼과 초안에 빈 제목이 들어가지 않는다', async () => {
    // Given
    const onValues = jest.fn();
    await renderPlan(PLAN, true, onValues);
    await fireEvent.press(await screen.findByText('장보기'));

    // When
    await fireEvent.changeText(await screen.findByLabelText('할 일 제목'), '');

    // Then
    await waitFor(() => expect(screen.getByTestId('plan-todo-edit-confirm')).toBeDisabled());
    const lastValues = onValues.mock.lastCall?.[0];
    expect(
      lastValues?.actions.map((action: { title: string }) => action.title) ?? [],
    ).not.toContain('');
    expect(screen.getByTestId('plan-review-apply')).toBeEnabled();
  });

  it('카드 제목을 고치고 확인하면 그때 목록에 반영된다', async () => {
    // Given
    await renderPlan();
    await fireEvent.press(await screen.findByText('장보기'));
    await fireEvent.changeText(await screen.findByLabelText('할 일 제목'), '마트 가기');
    expect(screen.queryByText('마트 가기')).toBeNull();

    // When
    await waitFor(() => expect(screen.getByTestId('plan-todo-edit-confirm')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('plan-todo-edit-confirm'));

    // Then
    expect(await screen.findByText('마트 가기')).toBeTruthy();
    expect(screen.queryByText('장보기')).toBeNull();
  });

  it('고치는 시트를 연 뒤 다른 카드의 체크를 바꿔도 확인이 그 변경을 되돌리지 않는다', async () => {
    // Given
    const onValues = jest.fn();
    await renderPlan(PLAN, true, onValues);
    await fireEvent.press(await screen.findByText('장보기'));
    await fireEvent.changeText(await screen.findByLabelText('할 일 제목'), '마트 가기');
    await fireEvent.press(screen.getByLabelText('운동 추가하기'));

    // When
    await waitFor(() => expect(screen.getByTestId('plan-todo-edit-confirm')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('plan-todo-edit-confirm'));

    // Then
    expect(await screen.findByText('마트 가기')).toBeTruthy();
    const latest: PlanReviewFormValues | undefined = onValues.mock.calls.at(-1)?.[0];
    expect(latest?.actions.map(({ title, isSelected }) => ({ title, isSelected }))).toEqual([
      { title: '운동', isSelected: false },
      { title: '마트 가기', isSelected: true },
    ]);
  });
});
