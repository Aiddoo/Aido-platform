import { zodResolver } from '@hookform/resolvers/zod';
import {
  memoScreenParamsSchema,
  useMemoScreenParams,
} from '@src/features/memo/hooks/use-memo-screen-params';
import { useGetMemoQueryOptions } from '@src/features/memo/queries/get-memo-query-options';
import { createMemoPlanDraftKey } from '@src/features/memo/utils/memo-plan-draft';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
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
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorBoundary, Result, StyledSafeAreaView } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';

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
      toast.warning(t('aiReview.draftLost'));
      goBack();
    }
    // 화면이 열릴 때 초안이 없을 때 한 번만 알리고 돌아간다
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
    <ScrollView contentContainerClassName="p-4 pb-6">
      <PlanReview
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
    </ScrollView>
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
      <QueryErrorBoundary resetKeys={[params.data.memoId]}>
        <Suspense
          fallback={
            <Box className="p-4">
              <PlanReview.Loading />
            </Box>
          }
        >
          <AiReviewScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
