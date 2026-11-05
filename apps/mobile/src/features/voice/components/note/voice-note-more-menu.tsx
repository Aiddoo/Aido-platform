import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { MenuActionItem, MoreIcon, TrashIcon, useConfirmDialog } from '@src/shared/ui';
import { Menu, PressableFeedback } from 'heroui-native';
import { useState } from 'react';

import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';

const VOICE_NOTE_MENU_WIDTH = 180;

interface VoiceNoteMoreMenuProps {
  onDeleted: () => void;
}

/** 머리글 ⋯. X와 같은 크기·터치 영역으로 오른쪽 끝선에 맞춘다 */
export function VoiceNoteMoreMenu({ onDeleted }: VoiceNoteMoreMenuProps) {
  const { t } = useTranslation('voiceNote');
  const { accountId, draftId } = useCurrentVoiceNote();
  const storage = useVoiceNoteStorageService();
  const confirmDialog = useConfirmDialog();
  const fontScaledSize = useFontScaledSize();
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async () => {
    const isConfirmed = await confirmDialog.open({
      title: t('result.deleteTitle'),
      description: t('result.deleteDescription'),
      confirmLabel: t('result.deleteConfirm'),
      confirmColor: 'danger',
      cancelLabel: t('result.deleteCancel'),
    });
    if (isConfirmed) {
      storage.discard(accountId, draftId);
      onDeleted();
    }
  };

  return (
    <Menu isOpen={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger asChild>
        <PressableFeedback
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('result.more')}
          accessibilityState={{ expanded: isOpen }}
          testID="voice-note-more"
        >
          <MoreIcon
            width={fontScaledSize(22)}
            height={fontScaledSize(22)}
            colorClassName="text-gray-7"
          />
        </PressableFeedback>
      </Menu.Trigger>
      <Menu.Portal disableFullWindowOverlay={false}>
        <Menu.Overlay />
        <Menu.Content
          presentation="popover"
          placement="bottom"
          align="end"
          width={VOICE_NOTE_MENU_WIDTH}
          className="rounded-2xl border border-gray-2 bg-gray-1"
        >
          <MenuActionItem
            variant="danger"
            icon={TrashIcon}
            title={t('result.delete')}
            onPress={handleDelete}
            testID="voice-note-delete"
          />
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
