import { zodResolver } from '@hookform/resolvers/zod';
import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { toInstant } from '@src/shared/date/instant';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { useTranslation } from '@src/shared/i18n';
import { Result } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import type { ComponentProps } from 'react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';

import { planReviewFormSchema, toVoicePlanFromDraft } from '../../domains/plan-review-form.schema';
import { type VoiceNote, VoiceNotePolicy } from '../../domains/voice-note.model';
import { voicePlanIdSchema } from '../../domains/voice-plan.model';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { PlanReview } from '../plan/plan-review';

interface VoiceNotePlanTodosProps extends Pick<ComponentProps<typeof PlanReview>, 'className'> {
  note: VoiceNote;
}

export function VoiceNotePlanTodos({ note, className }: VoiceNotePlanTodosProps) {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const { drafts } = useVoiceNoteStorageService();
  const [{ data: categoriesResult }] = useSuspenseQueries({
    queries: [useGetTodoCategoriesQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const fallbackCategoryId = categoriesResult.categories[0]?.id;
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
        title={
          VoiceNotePolicy.hasAppliedOnlyMemo(note) ? t('result.appliedMemo') : t('result.applied')
        }
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
          plan={toVoicePlanFromDraft(
            {
              planId: voicePlanIdSchema.parse(draftId),
              source: 'voice-note',
              sourceMemoId: null,
            },
            planDraft,
          )}
          fallbackCategoryId={fallbackCategoryId}
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
                VoiceNotePolicy.withAppliedAt(
                  latest,
                  toInstant(new Date().toISOString()),
                  todoCount,
                ),
              );
            }
          }}
        />
      ),
    )
    .exhaustive();
}
