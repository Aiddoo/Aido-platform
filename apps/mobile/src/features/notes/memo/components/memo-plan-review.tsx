import { zodResolver } from '@hookform/resolvers/zod';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { PlanReview } from '@src/features/voice/components/plan-review';
import { voicePlanIdSchema } from '@src/features/voice/domains/voice-plan.model';
import { planReviewFormSchema } from '@src/features/voice/schemas/plan-review-form.schema';
import { toDraftVoicePlan } from '@src/features/voice/utils/plan-review-draft';
import { toEpochMs } from '@src/shared/date/instant';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorFallback, type QueryErrorFallbackProps, Result } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useSuspenseQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useMemoId } from '../hooks/use-memo-params';
import { useRefreshMemos } from '../hooks/use-refresh-memos';
import { useGetMemoQueryOptions } from '../queries/memo.queries';
import { createMemoPlanDraftKey } from '../utils/memo-plan-draft';

/** 메모를 나눈 결과의 검토 폼. 기기에 남긴 초안으로 시작하고 저장하면 피드로 간다 */
export function MemoPlanReview() {
  const { t } = useTranslation('memo');
  const { timeZone } = useDateFormatContext();
  const goBack = useSingleTap(router.back);
  const dismiss = useSingleTap(router.dismiss);
  const navigate = useSingleTap(router.navigate);
  const toast = useAppToast();
  const refreshMemos = useRefreshMemos();
  const [memoId] = useMemoId();
  const [{ data: memo }, { data: user }, { data: categoriesResult }] = useSuspenseQueries({
    queries: [
      useGetMemoQueryOptions({ memoId }),
      useGetMeQueryOptions(),
      useGetTodoCategoriesQueryOptions(),
      // 결과는 쓰지 않는다. 아래 카드 행이 읽는 설정을 함께 받아 두 번 기다리지 않게 한다
      useGetPreferenceQueryOptions(),
    ],
  });
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(
    createMemoPlanDraftKey({ userId: user.id, memoId, timeZone }),
    { sourceUpdatedAt: toEpochMs(memo.updatedAt) },
  );
  const fallbackCategoryId = TodoCategoryPolicy.getInitialCategoryId(
    categoriesResult.categories,
    null,
  );

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
  }, [restoredDraft, goBack, toast, t]);

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
      className="flex-1"
      form={form}
      plan={toDraftVoicePlan(createMemoPlanIdentity(memoId), restoredDraft)}
      fallbackCategoryId={fallbackCategoryId}
      onMemoChanged={refreshMemos}
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

MemoPlanReview.Loading = function Loading() {
  return <PlanReview.Loading className="flex-1" />;
};

MemoPlanReview.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('memo');

  return <QueryErrorFallback title={t('aiReview.loadFailed')} reset={reset} />;
};

function createMemoPlanIdentity(memoId: number) {
  return {
    planId: voicePlanIdSchema.parse(`memo-${memoId}`),
    source: 'memo' as const,
    sourceMemoId: memoId,
  };
}
