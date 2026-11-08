import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTrack } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Button, IconButton, TrashIcon, useConfirmDialog } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

interface RemoveRecordingButtonProps {
  /** 없으면 모든 녹음을 지운다 */
  draftId?: string;
  onRemoved: () => void;
}

/** 확인을 받은 뒤 기기에 남긴 녹음 파일을 지운다. 지운 뒤 용량은 부모가 `onRemoved`에서 다시 읽는다 */
export function RemoveRecordingButton({ draftId, onRemoved }: RemoveRecordingButtonProps) {
  const { t } = useTranslation('settings');
  const { trackEvent } = useTrack();
  const confirmDialog = useConfirmDialog();
  const storage = useVoiceNoteStorageService();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());

  const handleRemove = async () => {
    const isConfirmed = await confirmDialog.openAsync({
      title: draftId == null ? t('voiceStorage.removeAllTitle') : t('voiceStorage.removeOneTitle'),
      description: t('voiceStorage.removeDescription'),
      confirmLabel: t('voiceStorage.removeConfirm'),
      confirmColor: 'danger',
      cancelLabel: t('voiceStorage.removeCancel'),
    });
    if (!isConfirmed) {
      return;
    }

    if (draftId == null) {
      storage.removeAllRecordings(me.id);
    } else {
      storage.removeRecordings(me.id, draftId);
    }
    onRemoved();
    trackEvent('settings_changed', {
      setting: 'voice_storage',
      value: draftId == null ? 'remove_all' : 'remove_one',
    });
  };
  // 확인 창이 뜨기 전에 한 번 더 눌러도 창이 두 번 열리지 않게 한다
  const remove = useSingleTap(handleRemove);

  if (draftId == null) {
    return (
      <Button variant="weak" color="danger" onPress={remove} testID="voice-storage-remove-all">
        {t('voiceStorage.removeAll')}
      </Button>
    );
  }

  return (
    <IconButton
      accessibilityLabel={t('voiceStorage.removeOneTitle')}
      icon={<TrashIcon width={20} height={20} colorClassName="text-gray-6" />}
      className="min-h-0 min-w-0"
      hitSlop={12}
      testID="voice-storage-remove"
      onPress={remove}
    />
  );
}
