import { zodResolver } from '@hookform/resolvers/zod';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/get-preference-query-options';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/get-me-query-options';
import { useMemoScreenParams } from '@src/features/notes/memo/hooks/use-memo-params';
import { useGetMemoQueryOptions } from '@src/features/notes/memo/queries/memo.queries';
import { memoScreenParamsSchema } from '@src/features/notes/memo/schemas/memo-params.schema';
import { createMemoPlanDraftKey } from '@src/features/notes/memo/utils/memo-plan-draft';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/todo/queries/get-todo-categories-query-options';
import { PlanReview } from '@src/features/voice/components/plan/plan-review';
import {
  planReviewFormSchema,
  toVoicePlanFromDraft,
} from '@src/features/voice/domains/plan-review-form.schema';
import { voicePlanIdSchema } from '@src/features/voice/domains/voice-plan.model';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, ReadableContent, Result, StyledSafeAreaView } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';

const PLAN_REVIEW_CLASS_NAME = 'flex-1 px-4 pb-3 pt-4';

function AiReviewScreen() {
  const { t } = useTranslation('memo');
  const goBack = useSingleTap(router.back);
  const dismiss = useSingleTap(router.dismiss);
  const navigate = useSingleTap(router.navigate);
  const toast = useAppToast();
  const { memoId } = useMemoScreenParams();
  const [{ data: memo }, { data: user }, { data: categoriesResult }] = useSuspenseQueries({
    queries: [
      useGetMemoQueryOptions({ memoId }),
      useGetMeQueryOptions(),
      useGetTodoCategoriesQueryOptions(),
      useGetPreferenceQueryOptions(),
    ],
  });
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(
    createMemoPlanDraftKey({ userId: user.id, memoId }),
    { sourceUpdatedAt: memo.updatedAt.getTime() },
  );
  const fallbackCategoryId = categoriesResult.categories[0]?.id;

  const form = useForm({
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
      toast.warning(t('aiReview.draftLost'));
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
    <PlanReview
      className={PLAN_REVIEW_CLASS_NAME}
      form={form}
      plan={toVoicePlanFromDraft(createMemoPlanIdentity(memoId), restoredDraft)}
      fallbackCategoryId={fallbackCategoryId}
      onApplied={() => {
        discardDraft();
        dismiss();
        navigate('/feed');
      }}
      onSourceMissing={() => {
        discardDraft();
        dismiss();
        navigate('/memo');
      }}
    />
  );
}

const createMemoPlanIdentity = (memoId: number) => ({
  planId: voicePlanIdSchema.parse(`memo-${memoId}`),
  source: 'memo' as const,
  sourceMemoId: memoId,
});

export default function AiReviewRoute() {
  const params = memoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <QueryErrorBoundary resetKeys={[params.data.memoId]}>
          <Suspense fallback={<PlanReview.Loading className={PLAN_REVIEW_CLASS_NAME} />}>
            <AiReviewScreen />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
