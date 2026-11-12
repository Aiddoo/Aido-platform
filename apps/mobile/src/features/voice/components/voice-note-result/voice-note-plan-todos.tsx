import { zodResolver } from '@hookform/resolvers/zod';
import { useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { getNowInstant } from '@src/shared/date/clock';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { useTranslation } from '@src/shared/i18n';
import { Result } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import type { ComponentProps } from 'react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';

import { VoiceNotePolicy } from '../../domains/voice-note.model';
import { voicePlanIdSchema } from '../../domains/voice-plan.model';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { useVoiceNoteDraftId } from '../../hooks/use-voice-note-params';
import { planReviewFormSchema } from '../../schemas/plan-review-form.schema';
import { toDraftVoicePlan } from '../../utils/plan-review-draft';
import { PlanReview } from '../plan-review';

type VoiceNotePlanTodosProps = Pick<
  ComponentProps<typeof PlanReview>,
  'className' | 'onMemoChanged'
>;

export function VoiceNotePlanTodos({ className, onMemoChanged }: VoiceNotePlanTodosProps) {
  const { t } = useTranslation(['voiceNote', 'voicePlan']);
  const accountId = useSuspenseMyAccountId();
  const [draftId] = useVoiceNoteDraftId();
  const note = useCurrentVoiceNote(accountId);
  const drafts = useVoiceNoteDraftRepository();
  // 설정 쿼리는 값을 쓰지 않는다. 아래 PlanReview.TodoRow가 같은 설정을 기다리다 카드 사이에서 멈추지 않게 미리 받는다
  const [{ data: categoriesResult }] = useSuspenseQueries({
    queries: [useGetTodoCategoriesQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const fallbackCategoryId = TodoCategoryPolicy.getInitialCategoryId(
    categoriesResult.categories,
    null,
  );
  const form = useForm({
    resolver: zodResolver(planReviewFormSchema),
    defaultValues: note.planDraft?.form ?? { actions: [] },
    mode: 'onChange',
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
        <PlanReview
          className={className}
          form={form}
          plan={toDraftVoicePlan(
            {
              planId: voicePlanIdSchema.parse(draftId),
              source: 'voice-note',
              sourceMemoId: null,
            },
            planDraft,
          )}
          fallbackCategoryId={fallbackCategoryId}
          onMemoChanged={onMemoChanged}
          requestStore={{
            find: () => drafts.find(accountId, draftId)?.planApplyRequest ?? null,
            save: (request) => {
              const latest = drafts.find(accountId, draftId);
              if (latest != null) {
                drafts.save(accountId, VoiceNotePolicy.withPlanApplyRequest(latest, request));
              }
            },
          }}
          onSaved={({ todoCount }) => {
            const latest = drafts.find(accountId, draftId);
            if (latest != null) {
              drafts.save(
                accountId,
                VoiceNotePolicy.withAppliedAt(latest, getNowInstant(), todoCount),
              );
            }
          }}
        />
      ),
    )
    .exhaustive();
}
