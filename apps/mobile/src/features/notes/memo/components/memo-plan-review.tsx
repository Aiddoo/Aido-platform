import { zodResolver } from '@hookform/resolvers/zod';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { PlanReview } from '@src/features/voice/components/plan-review';
import {
  createDraftVoicePlan,
  type PlanReviewDraft,
  type SelectablePlannedAction,
} from '@src/features/voice/domains/plan-review-draft.model';
import { voicePlanIdSchema } from '@src/features/voice/domains/voice-plan.model';
import { usePlanApply } from '@src/features/voice/hooks/use-plan-apply';
import { planReviewFormSchema } from '@src/features/voice/schemas/plan-review-form.schema';
import { toEpochMs } from '@src/shared/date/instant';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorFallback, type QueryErrorFallbackProps, Result } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FormState, useForm, Watch } from 'react-hook-form';

import { useMemoId } from '../hooks/use-memo-params';
import { useRefreshMemos } from '../hooks/use-refresh-memos';
import { useGetMemoQueryOptions } from '../queries/memo.queries';
import { createMemoPlanDraftKey } from '../utils/memo-plan-draft';

export function MemoPlanReview() {
  const { t } = useTranslation('memo');
  const { timezone } = useDateFormatContext();
  const goBack = useGoBack({ fallbackHref: '/memo' });
  const toast = useAppToast();
  const [memoId] = useMemoId();
  const [{ data: memo }, { data: me }, { data: categoriesResult }] = useSuspenseQueries({
    queries: [
      useGetMemoQueryOptions({ memoId }),
      useGetMeQueryOptions(),
      useGetTodoCategoriesQueryOptions(),
      // 결과는 쓰지 않는다. 아래 카드 행이 읽는 설정을 함께 받아 두 번 기다리지 않게 한다
      useGetPreferenceQueryOptions(),
    ],
  });
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(
    createMemoPlanDraftKey({ userId: me.id, memoId, timezone }),
    { sourceUpdatedAt: toEpochMs(memo.updatedAt) },
  );
  const fallbackCategoryId = TodoCategoryPolicy.findInitialCategoryId(
    categoriesResult.categories,
    null,
  );

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
    <MemoPlanReview.Contents
      draft={restoredDraft}
      fallbackCategoryId={fallbackCategoryId}
      onDraftChange={saveDraft}
      onDraftClear={clearDraft}
    />
  );
}

interface MemoPlanReviewContentsProps {
  draft: PlanReviewDraft;
  fallbackCategoryId: number;
  onDraftChange: (draft: PlanReviewDraft) => void;
  onDraftClear: () => void;
}

MemoPlanReview.Contents = function Contents({
  draft,
  fallbackCategoryId,
  onDraftChange,
  onDraftClear,
}: MemoPlanReviewContentsProps) {
  const reportUnexpectedError = useReportUnexpectedError('memo');
  const router = useRouter();
  const dismiss = useSingleTap(router.dismiss);
  const navigate = useSingleTap(router.navigate);
  const refreshMemos = useRefreshMemos();
  const [memoId] = useMemoId();
  const form = useForm({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: draft.form,
    mode: 'onChange',
  });
  // 나눈 결과는 저장하기 전까지 기기에 남긴다. 초안이 비었을 때만 지우므로 고치지 않은 상태도 남는다
  const discardDraft = useFormDraftAutosave(form.subscribe, {
    initialValues: { actions: [] },
    saveDraft: (values) =>
      onDraftChange({ omittedTodoCount: draft.omittedTodoCount, form: values }),
    clearDraft: onDraftClear,
  });
  const plan = createDraftVoicePlan(createMemoPlanIdentity(memoId), draft);
  const planApply = usePlanApply({
    plan,
    fallbackCategoryId,
    onMemoChanged: refreshMemos,
    onApplied: () => {
      discardDraft();
      dismiss();
      navigate('/feed');
    },
    onSourceMissing: () => {
      discardDraft();
      dismiss();
      navigate('/memo');
    },
  });

  // 고친 카드의 자리만 쓴다. 배열을 통째로 바꾸면 그 사이 다른 카드에 생긴 변경을 덮는다
  const changeAction = (index: number, action: SelectablePlannedAction) =>
    form.setValue(`actions.${index}`, action, { shouldDirty: true, shouldValidate: true });

  const savePlan = form.handleSubmit(({ actions }) => planApply.apply(actions));
  // 저장 중 표시는 다음 렌더에야 켜져 같은 프레임의 두 번째 탭이 같은 계획을 한 번 더 보낸다
  const handleSavePress = useSingleTap(() => {
    savePlan().catch(reportUnexpectedError);
  });

  return (
    <FormState
      control={form.control}
      render={({ isValid }) => (
        <Watch
          control={form.control}
          name="actions"
          render={(actions) => (
            <PlanReview
              className="flex-1"
              value={actions}
              onItemChange={changeAction}
              plan={plan}
              fallbackCategoryId={fallbackCategoryId}
              isValid={isValid}
              isApplying={planApply.isPending || planApply.isApplied}
              onApplyPress={handleSavePress}
            />
          )}
        />
      )}
    />
  );
};

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
