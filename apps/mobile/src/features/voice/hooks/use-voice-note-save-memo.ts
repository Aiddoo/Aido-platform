import { useIdGenerator, useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { toInstant } from '@src/shared/date/instant';
import { useMutation } from '@tanstack/react-query';

import { VoiceNotePolicy } from '../domains/voice-note.model';
import { isPlanKeyConflictError } from '../domains/voice.error';
import { useApplyActionPlanMutationOptions } from '../queries/voice.mutations';
import { type VoiceNote } from '../schemas/voice-note.schema';
import { useCurrentVoiceNote } from './use-current-voice-note';

/** 메모만 저장할 때 넘기는 값. 메모는 카테고리를 쓰지 않아 저장 요청에 실리지 않는다 */
const UNUSED_CATEGORY_ID = 0;

export function useVoiceNoteSaveMemo(note: VoiceNote) {
  const { accountId, draftId } = useCurrentVoiceNote();
  const { drafts } = useVoiceNoteStorageService();
  const idGenerator = useIdGenerator();
  const mutation = useMutation(
    useApplyActionPlanMutationOptions({
      onSaved: () => {
        const latest = drafts.find(accountId, draftId);
        if (latest != null) {
          drafts.save(
            accountId,
            VoiceNotePolicy.withMemoSavedAt(latest, toInstant(new Date().toISOString())),
          );
        }
      },
    }),
  );
  const memo = VoiceNotePolicy.createDigestMemo(note);

  const saveMemoRequest = (idempotencyKey: string | null) => {
    const latest = drafts.find(accountId, draftId);
    if (latest != null) {
      drafts.save(
        accountId,
        VoiceNotePolicy.withMemoSaveRequest(
          latest,
          idempotencyKey == null ? null : { idempotencyKey },
        ),
      );
    }
  };

  const saveMemo = () => {
    if (memo == null || mutation.isPending) {
      return;
    }
    // 응답을 놓친 뒤 다시 눌러도 같은 키라 메모가 두 장이 되지 않는다
    const idempotencyKey = note.memoSaveRequest?.idempotencyKey ?? idGenerator.create();
    saveMemoRequest(idempotencyKey);
    mutation.mutate(
      {
        source: 'voice-note',
        sourceMemoId: null,
        actions: [memo],
        fallbackCategoryId: UNUSED_CATEGORY_ID,
        skippedCount: 0,
        idempotencyKey,
      },
      {
        onError: (error) => {
          if (isPlanKeyConflictError(error)) {
            saveMemoRequest(null);
          }
        },
      },
    );
  };

  return {
    saveMemo,
    canSaveMemo: memo != null,
    isMemoSaved: note.memoSavedAt != null,
    isSavingMemo: mutation.isPending,
  };
}
