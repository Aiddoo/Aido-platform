import { zodResolver } from '@hookform/resolvers/zod';
import {
  memoScreenParamsSchema,
  useMemoScreenParams,
} from '@src/features/memo/hooks/use-memo-screen-params';
import { useGetMemoQueryOptions } from '@src/features/memo/queries/get-memo-query-options';
import { createMemoPlanDraftKey } from '@src/features/memo/utils/memo-plan-draft';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { PlanReview } from '@src/features/voice/components/plan/plan-review';
import {
  type PlanReviewFormValues,
  planReviewFormSchema,
  toVoicePlanFromDraft,
} from '@src/features/voice/domains/plan-review-form.schema';
import { voicePlanIdSchema } from '@src/features/voice/domains/voice-plan.model';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Result, StyledSafeAreaView } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, ScrollView } from 'react-native';

function AiReviewScreen() {
  const { t } = useTranslation('memo');
  const goBack = useSingleTap(router.back);
  const dismiss = useSingleTap(router.dismiss);
  const navigate = useSingleTap(router.navigate);
  const { memoId } = useMemoScreenParams();
  const [{ data: memo }, { data: user }, { data: categoriesResult }] = useSuspenseQueries({
    queries: [
      useGetMemoQueryOptions({ memoId }),
      useGetMeQueryOptions(),
      useGetTodoCategoriesQueryOptions(),
    ],
  });
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(
    createMemoPlanDraftKey({ userId: user.id, memoId }),
    { sourceUpdatedAt: memo.updatedAt.getTime() },
  );
  const fallbackCategoryId = categoriesResult.categories[0]?.id;

  const form = useForm<PlanReviewFormValues>({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: restoredDraft?.form,
    mode: 'onChange',
  });
  // 나눈 결과는 저장하기 전까지 기기에 남긴다. 초안이 비었을 때만 지우므로 고치지 않은 상태도 남는다
  const discardDraft = useFormDraftAutosave(form.subscribe, {
    initialValues: { actions: [] },
    saveDraft: (form) =>
      saveDraft({ omittedTodoCount: restoredDraft?.omittedTodoCount ?? 0, form }),
    clearDraft,
  });

  useEffect(() => {
    if (restoredDraft == null) {
      goBack();
    }
  }, [restoredDraft, goBack]);

  if (restoredDraft == null) {
    return null;
  }

  if (fallbackCategoryId == null) {
    return (
      <Result
        title={t('aiReview.noCategory')}
        button={<Result.Button onPress={() => goBack()}>{t('aiReview.goBack')}</Result.Button>}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <PlanReview
        form={form}
        plan={toVoicePlanFromDraft(planIdOf(memoId), restoredDraft)}
        fallbackCategoryId={fallbackCategoryId}
        onApplied={() => {
          discardDraft();
          dismiss();
          navigate('/feed');
        }}
      />
    </ScrollView>
  );
}

const planIdOf = (memoId: number) => ({
  planId: voicePlanIdSchema.parse(`memo-${memoId}`),
  source: 'memo' as const,
});

export default function AiReviewRoute() {
  const params = memoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[params.data.memoId]}>
        <Suspense fallback={<ActivityIndicator className="flex-1" />}>
          <AiReviewScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
