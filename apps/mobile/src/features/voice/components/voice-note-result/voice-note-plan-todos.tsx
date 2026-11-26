import { zodResolver } from '@hookform/resolvers/zod';
import { useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { getNowInstant } from '@src/shared/date/clock';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorFallback, type QueryErrorFallbackProps, Result } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { FormState, useForm, Watch } from 'react-hook-form';
import { match } from 'ts-pattern';

import {
  createDraftVoicePlan,
  type PlanReviewDraft,
  type SelectablePlannedAction,
} from '../../domains/plan-review-draft.model';
import { VoiceNotePolicy } from '../../domains/voice-note.model';
import { voicePlanIdSchema } from '../../domains/voice-plan.model';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { usePlanApply } from '../../hooks/use-plan-apply';
import { useVoiceNoteDraftId } from '../../hooks/use-voice-note-params';
import { planReviewFormSchema } from '../../schemas/plan-review-form.schema';
import { PlanReview } from '../plan-review';

interface VoiceNotePlanTodosProps {
  onMemoChanged: () => void;
  className?: string;
}

export function VoiceNotePlanTodos({ onMemoChanged, className }: VoiceNotePlanTodosProps) {
  const { t } = useTranslation(['voiceNote', 'voicePlan']);
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);
  // 설정 쿼리는 값을 쓰지 않는다. 아래 PlanReview.TodoItem이 같은 설정을 기다리다 카드 사이에서 멈추지 않게 미리 받는다
  const [{ data: categoriesResult }] = useSuspenseQueries({
    queries: [useGetTodoCategoriesQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const fallbackCategoryId = TodoCategoryPolicy.findInitialCategoryId(
    categoriesResult.categories,
    null,
  );

  return match(VoiceNotePolicy.getPlanStatus(note))
    .with({ status: 'applied' }, () => (
      <Result
        // 말로 정리하기 시트가 추가한 뒤 보여 주는 문구와 같다. 수를 남기기 전에 추가한 노트는 수 없이 알린다
        title={match(VoiceNotePolicy.findTodoCount(note))
          .when(
            () => VoiceNotePolicy.hasAppliedOnlyMemo(note),
            () => t('result.appliedMemo'),
          )
          .with(null, () => t('result.applied'))
          .otherwise((count) => t('voicePlan:applied.todos', { count }))}
        testID="voice-note-applied"
      />
    ))
    .with({ status: 'no-todos' }, () => (
      <Result title={t('result.noTodos')} testID="voice-note-no-todos" />
    ))
    .with({ status: 'lost' }, () => (
      <Result title={t('result.planLost')} testID="voice-note-plan-lost" />
    ))
    .with({ status: 'reviewable' }, ({ planDraft }) =>
      fallbackCategoryId == null ? (
        <Result title={t('result.noTodos')} />
      ) : (
        <VoiceNotePlanTodos.Contents
          planDraft={planDraft}
          fallbackCategoryId={fallbackCategoryId}
          onMemoChanged={onMemoChanged}
          className={className}
        />
      ),
    )
    .exhaustive();
}

interface VoiceNotePlanTodosContentsProps extends VoiceNotePlanTodosProps {
  planDraft: PlanReviewDraft;
  fallbackCategoryId: number;
}

/** 고르는 폼. 떠 있는 동안 고친 값을 초안에 남기고, 저장 요청의 키와 저장한 사실도 초안에 남긴다 */
VoiceNotePlanTodos.Contents = function Contents({
  planDraft,
  fallbackCategoryId,
  onMemoChanged,
  className,
}: VoiceNotePlanTodosContentsProps) {
  const reportUnexpectedError = useReportUnexpectedError('voice');
  const accountId = useSuspenseMyAccountId();
  const [draftId] = useVoiceNoteDraftId();
  const drafts = useVoiceNoteDraftRepository();
  const form = useForm({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: planDraft.form,
    mode: 'onChange',
  });
  const plan = createDraftVoicePlan(
    { planId: voicePlanIdSchema.parse(draftId), source: 'voice-note', sourceMemoId: null },
    planDraft,
  );
  const planApply = usePlanApply({
    plan,
    fallbackCategoryId,
    onMemoChanged,
    requestStore: {
      find: () => drafts.find(accountId, draftId)?.planApplyRequest ?? null,
      save: (request) => {
        const latest = drafts.find(accountId, draftId);
        if (latest != null) {
          drafts.save(accountId, VoiceNotePolicy.withPlanApplyRequest(latest, request));
        }
      },
    },
    onSaved: ({ todoCount }) => {
      const latest = drafts.find(accountId, draftId);
      if (latest != null) {
        drafts.save(accountId, VoiceNotePolicy.withAppliedAt(latest, getNowInstant(), todoCount));
      }
    },
  });

  useFormDraftAutosave(form.subscribe, {
    initialValues: { actions: [] },
    saveDraft: (values) => {
      const latest = drafts.find(accountId, draftId);
      if (latest?.planDraft != null) {
        drafts.save(
          accountId,
          VoiceNotePolicy.withPlanDraft(latest, {
            omittedTodoCount: latest.planDraft.omittedTodoCount,
            form: values,
          }),
        );
      }
    },
    clearDraft: noop,
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
              className={className}
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

VoiceNotePlanTodos.Loading = function Loading({
  className,
}: Pick<VoiceNotePlanTodosProps, 'className'>) {
  return <PlanReview.Loading className={className} />;
};

VoiceNotePlanTodos.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};
