import '@src/shared/i18n/init';
import { zodResolver } from '@hookform/resolvers/zod';
import { createActivationProgressRepository } from '@src/features/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/activation/apis/activation.service';
import { PreferenceService } from '@src/features/preference/apis/preference.service';
import { PREFERENCE_QUERY_KEYS } from '@src/features/preference/constants/preference-query-keys';
import { TodoCategoryService } from '@src/features/todo/apis/todo-category.service';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/constants/todo-category-query-keys';
import {
  createErrorReporterStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { VoiceService } from '../../apis/voice.service';
import {
  createPlanReviewFormValues,
  type PlanReviewFormValues,
  planReviewFormSchema,
} from '../../domains/plan-review-form.schema';
import {
  type PlannedTodo,
  type VoicePlan,
  voicePlanIdSchema,
} from '../../domains/voice-plan.model';
import { PlanReview } from './plan-review';

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const createTodoAction = (overrides: Partial<PlannedTodo>): PlannedTodo => ({
  type: 'create-todo',
  actionId: 'todo-1',
  title: '운동',
  startDate: new Date(2026, 10, 5, 12),
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

function PlanReviewScreen({
  plan = PLAN,
  isCharged,
  onValues,
}: {
  plan?: VoicePlan;
  isCharged?: boolean;
  onValues?: (values: PlanReviewFormValues) => void;
}) {
  const form = useForm<PlanReviewFormValues>({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: createPlanReviewFormValues(plan),
    mode: 'onChange',
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

  return (
    <PlanReview
      form={form}
      plan={plan}
      isCharged={isCharged}
      fallbackCategoryId={1}
      onApplied={jest.fn()}
    />
  );
}

async function renderPlan(
  plan?: VoicePlan,
  isCharged?: boolean,
  onValues?: (values: PlanReviewFormValues) => void,
  httpClient: ReturnType<typeof createMockHttpClient> = createMockHttpClient(),
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
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), { timeFormat: 'H12' });

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <Suspense fallback={null}>
          <PlanReviewScreen plan={plan} isCharged={isCharged} onValues={onValues} />
        </Suspense>
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: {
        analytics: createMockAnalytics(),
        errorReporter: createErrorReporterStub(),
        voiceService: new VoiceService(httpClient, silentLogger),
        todoCategoryService: new TodoCategoryService(createMockHttpClient()),
        preferenceService: new PreferenceService(createMockHttpClient()),
        activationService: new ActivationService(
          createActivationProgressRepository(createMemorySyncStorage()),
        ),
      },
      queryClient,
    },
  );
}

describe('PlanReview', () => {
  test('반복은 같은 요약 문구로 보이고 고른 카드 수가 버튼에 나타난다', async () => {
    // Given & When
    await renderPlan();

    // Then
    expect(await screen.findByText('격주 화')).toBeTruthy();
    expect(screen.getByText('할 일 2개 추가')).toBeTruthy();
  });

  test('동그라미를 끄면 추가할 개수가 줄어든다', async () => {
    // Given
    await renderPlan();

    // When
    await fireEvent.press(await screen.findByLabelText('장보기 추가하기'));

    // Then
    await waitFor(() => expect(screen.getByText('할 일 1개 추가')).toBeTruthy());
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

    test('카테고리 머리글을 한 번씩만 보이고 카드를 그 아래로 모은다', async () => {
      // When
      await renderPlan(SPLIT_PLAN);

      // Then
      expect(await screen.findAllByText('기본')).toHaveLength(1);
      expect(screen.getAllByText('중요한 일')).toHaveLength(1);
      expect(screen.getAllByText(/장보기|세금 신고|운동/).map((row) => row.props.children)).toEqual(
        ['장보기', '운동', '세금 신고'],
      );
    });

    test('모아 보여도 고친 값은 그 카드의 자리에 들어간다', async () => {
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

    test('저장은 묶어 보인 순서대로 보낸다', async () => {
      // Given
      const httpClient = createMockHttpClient();
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

  test('제목이 비어 저장할 수 없는 카드가 있으면 추가 버튼을 막는다', async () => {
    // Given
    await renderPlan({
      ...PLAN,
      actions: [createTodoAction({ title: '' }), GROCERIES],
    });

    // Then
    await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeDisabled());
  });

  test('성공 응답의 charged가 false여도 카드가 있으면 차감 문구를 보이지 않는다', async () => {
    // Given
    const isCharged = false;

    // When
    await renderPlan(PLAN, isCharged);

    // Then
    expect(await screen.findByText('장보기')).toBeTruthy();
    expect(screen.queryByText('횟수는 차감되지 않았어요')).toBeNull();
  });

  test('카드 제목을 지워도 확인 전에는 폼과 초안에 빈 제목이 들어가지 않는다', async () => {
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

  test('카드 제목을 고치고 확인하면 그때 목록에 반영된다', async () => {
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
});
