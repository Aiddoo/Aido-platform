import { useIdGenerator, useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import { getNowInstant } from '@src/shared/date/clock';
import { useMutation } from '@tanstack/react-query';

import { VoiceNotePolicy, type VoiceNote, createDigestMemo } from '../domains/voice-note.model';
import { isPlanKeyConflictError } from '../domains/voice.error';
import { useApplyActionPlanMutationOptions } from '../queries/voice.mutations';
import { useVoiceNoteRoute } from './use-current-voice-note';

/** 메모만 저장할 때 넘기는 값. 메모는 카테고리를 쓰지 않아 저장 요청에 실리지 않는다 */
const UNUSED_CATEGORY_ID = 0;

interface UseVoiceNoteSaveMemoOptions {
  note: VoiceNote;
  onMemoChanged: () => void;
}

export function useVoiceNoteSaveMemo({ note, onMemoChanged }: UseVoiceNoteSaveMemoOptions) {
  const [{ accountId, draftId }] = useVoiceNoteRoute();
  const drafts = useVoiceNoteDraftRepository();
  const idGenerator = useIdGenerator();
  const mutation = useMutation(
    useApplyActionPlanMutationOptions({
      onMemoChanged,
      onSaved: () => {
        const latest = drafts.find(accountId, draftId);
        if (latest != null) {
          drafts.save(accountId, VoiceNotePolicy.withMemoSavedAt(latest, getNowInstant()));
        }
      },
    }),
  );
  const memo = createDigestMemo(note);

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
