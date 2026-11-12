import Check from '@expo/material-symbols/check.xml';
import Delete from '@expo/material-symbols/delete.xml';
import NoteAdd from '@expo/material-symbols/note_add.xml';
import {
  useIdGenerator,
  useVoiceNoteDraftRepository,
  useVoiceNoteStorageService,
} from '@src/bootstrap/providers/di-context';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useTranslation } from '@src/shared/i18n';
import { STACK_MORE_ICON, useConfirmDialog } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { createDigestMemo, VoiceNotePolicy } from '../../domains/voice-note.model';
import { isPlanKeyConflictError } from '../../domains/voice.error';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { useVoiceNoteDraftId } from '../../hooks/use-voice-note-params';
import { useApplyActionPlanMutationOptions } from '../../queries/voice.mutations';

const VOICE_NOTE_TOOLBAR_ICON = {
  saveMemo: process.env.EXPO_OS === 'ios' ? 'note.text.badge.plus' : NoteAdd,
  memoSaved: process.env.EXPO_OS === 'ios' ? 'checkmark' : Check,
  delete: process.env.EXPO_OS === 'ios' ? 'trash' : Delete,
} as const;

/** 메모만 저장할 때 넘기는 값. 메모는 카테고리를 쓰지 않아 저장 요청에 실리지 않는다 */
const UNUSED_CATEGORY_ID = 0;

interface VoiceNoteToolbarProps {
  onMemoChanged: () => void;
}

export function VoiceNoteToolbar({ onMemoChanged }: VoiceNoteToolbarProps) {
  const { t } = useTranslation('voiceNote');
  const { trackEvent } = useTrack();
  const accountId = useSuspenseMyAccountId();
  const [draftId] = useVoiceNoteDraftId();
  const note = useCurrentVoiceNote(accountId);
  const storage = useVoiceNoteStorageService();
  const confirmDialog = useConfirmDialog();
  const closeScreen = useGoBack({ fallbackHref: '/memo' });
  const { saveMemo, canSaveMemo, isMemoSaved, isSavingMemo } = useVoiceNoteSaveMemo({
    onMemoChanged,
  });
  const saveMemoLabel = isMemoSaved ? t('result.memoSaved') : t('result.saveMemo');

  const handleDelete = async () => {
    const isConfirmed = await confirmDialog.openAsync({
      title: t('result.deleteTitle'),
      description: t('result.deleteDescription'),
      confirmLabel: t('result.deleteConfirm'),
      confirmColor: 'danger',
      cancelLabel: t('result.deleteCancel'),
    });
    if (isConfirmed) {
      trackEvent('voice_note_deleted', { is_digested: VoiceNotePolicy.isDigested(note) });
      storage.discard(accountId, draftId);
      closeScreen();
    }
  };

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        hidden={!isMemoSaved && !canSaveMemo}
        icon={isMemoSaved ? VOICE_NOTE_TOOLBAR_ICON.memoSaved : VOICE_NOTE_TOOLBAR_ICON.saveMemo}
        accessibilityLabel={saveMemoLabel}
        disabled={isMemoSaved || isSavingMemo}
        onPress={saveMemo}
      >
        {saveMemoLabel}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Menu icon={STACK_MORE_ICON} accessibilityLabel={t('result.more')}>
        <Stack.Toolbar.MenuAction
          icon={VOICE_NOTE_TOOLBAR_ICON.delete}
          destructive
          onPress={handleDelete}
        >
          {t('result.delete')}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

interface UseVoiceNoteSaveMemoOptions {
  onMemoChanged: () => void;
}

function useVoiceNoteSaveMemo({ onMemoChanged }: UseVoiceNoteSaveMemoOptions) {
  const accountId = useSuspenseMyAccountId();
  const [draftId] = useVoiceNoteDraftId();
  const note = useCurrentVoiceNote(accountId);
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
