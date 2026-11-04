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
import { Suspense } from 'react';
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

function PlanReviewScreen({ plan = PLAN }: { plan?: VoicePlan }) {
  const form = useForm<PlanReviewFormValues>({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: createPlanReviewFormValues(plan),
    mode: 'onChange',
  });

  return <PlanReview form={form} plan={plan} fallbackCategoryId={1} onApplied={jest.fn()} />;
}

async function renderPlan(plan?: VoicePlan) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [{ id: 1, name: '기본', color: '#3B82F6', sortOrder: 0, todoCount: 2 }],
  });
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), { timeFormat: 'H12' });

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <Suspense fallback={null}>
          <PlanReviewScreen plan={plan} />
        </Suspense>
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: {
        analytics: createMockAnalytics(),
        errorReporter: createErrorReporterStub(),
        voiceService: new VoiceService(createMockHttpClient(), silentLogger),
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

  test('제목이 비어 저장할 수 없는 카드가 있으면 추가 버튼을 막는다', async () => {
    // Given
    await renderPlan({
      ...PLAN,
      actions: [createTodoAction({ title: '' }), GROCERIES],
    });

    // Then
    await waitFor(() => expect(screen.getByTestId('plan-review-apply')).toBeDisabled());
  });
});
