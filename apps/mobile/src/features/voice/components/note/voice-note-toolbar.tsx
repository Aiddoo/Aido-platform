import Check from '@expo/material-symbols/check.xml';
import Delete from '@expo/material-symbols/delete.xml';
import NoteAdd from '@expo/material-symbols/note_add.xml';
import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useTranslation } from '@src/shared/i18n';
import { STACK_MORE_ICON, useConfirmDialog } from '@src/shared/ui';
import { Stack } from 'expo-router';

import { useVoiceNoteRoute } from '../../hooks/use-current-voice-note';
import { useVoiceNoteSaveMemo } from '../../hooks/use-voice-note-save-memo';

const VOICE_NOTE_TOOLBAR_ICON = {
  saveMemo: process.env.EXPO_OS === 'ios' ? 'note.text.badge.plus' : NoteAdd,
  memoSaved: process.env.EXPO_OS === 'ios' ? 'checkmark' : Check,
  delete: process.env.EXPO_OS === 'ios' ? 'trash' : Delete,
} as const;

interface VoiceNoteToolbarProps {
  onMemoChanged: () => void;
}

export function VoiceNoteToolbar({ onMemoChanged }: VoiceNoteToolbarProps) {
  const { t } = useTranslation('voiceNote');
  const [{ accountId, draftId }] = useVoiceNoteRoute();
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
