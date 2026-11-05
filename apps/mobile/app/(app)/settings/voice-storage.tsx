import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { VoiceNotePolicy } from '@src/features/voice/domains/voice-note.model';
import { formatMediaTime } from '@src/features/voice/utils/format-media-time';
import { useTrack } from '@src/shared/analytics';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  HStack,
  QueryErrorBoundary,
  Result,
  SettingsCard,
  StyledSafeAreaView,
  Text,
  TextSkeleton,
  TrashIcon,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { formatFileSize } from '@src/shared/utils/format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { Suspense, useState } from 'react';
import { ScrollView } from 'react-native';

function VoiceStorageScreen() {
  const { t } = useTranslation('settings');
  const { t: tVoiceNote } = useTranslation('voiceNote');
  const { trackEvent } = useTrack();
  const dateFormatContext = useDateFormatContext();
  const confirmDialog = useConfirmDialog();
  const storage = useVoiceNoteStorageService();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const [usage, setUsage] = useState(() => storage.getRecordingUsage(me.id));

  const handleRemoveOne = async (draftId: string) => {
    const isConfirmed = await confirmDialog.open({
      title: t('voiceStorage.removeOneTitle'),
      description: t('voiceStorage.removeDescription'),
      confirmLabel: t('voiceStorage.removeConfirm'),
      confirmColor: 'danger',
      cancelLabel: t('voiceStorage.removeCancel'),
    });
    if (isConfirmed) {
      storage.removeRecordings(me.id, draftId);
      setUsage(storage.getRecordingUsage(me.id));
      trackEvent('settings_changed', { setting: 'voice_storage', value: 'remove_one' });
    }
  };

  const handleRemoveAll = async () => {
    const isConfirmed = await confirmDialog.open({
      title: t('voiceStorage.removeAllTitle'),
      description: t('voiceStorage.removeDescription'),
      confirmLabel: t('voiceStorage.removeConfirm'),
      confirmColor: 'danger',
      cancelLabel: t('voiceStorage.removeCancel'),
    });
    if (isConfirmed) {
      storage.removeAllRecordings(me.id);
      setUsage(storage.getRecordingUsage(me.id));
      trackEvent('settings_changed', { setting: 'voice_storage', value: 'remove_all' });
    }
  };

  return (
    <VStack gap={12}>
      <SettingsCard>
        <VStack gap={4}>
          <Text size="b4" shade={6}>
            {t('voiceStorage.totalLabel')}
          </Text>
          <Text size="t2" weight="bold" className="tabular-nums" testID="voice-storage-total">
            {formatFileSize(usage.totalBytes, dateFormatContext.locale)}
          </Text>
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {t('voiceStorage.description')}
          </Text>
        </VStack>
      </SettingsCard>

      {usage.notes.length === 0 ? (
        <Result title={t('voiceStorage.empty')} className="py-10" testID="voice-storage-empty" />
      ) : (
        <SettingsCard>
          {usage.notes.map(({ note, bytes }) => (
            <HStack key={note.draftId} gap={12} align="center" testID="voice-storage-row">
              <VStack flex={1} gap={2}>
                <Text size="b3" weight="medium" maxLines={1}>
                  {VoiceNotePolicy.getDigestTitle(note) ?? tVoiceNote('result.defaultTitle')}
                </Text>
                <Text size="e1" shade={6} maxLines={1} className="tabular-nums">
                  {tVoiceNote('result.meta', {
                    date: formatDateLabel(note.createdAt, 'monthDay', dateFormatContext),
                    duration: formatMediaTime(note.durationMs),
                  })}
                </Text>
              </VStack>
              <Text size="b4" shade={7} maxLines={1} className="tabular-nums">
                {formatFileSize(bytes, dateFormatContext.locale)}
              </Text>
              <PressableFeedback
                onPress={() => handleRemoveOne(note.draftId)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('voiceStorage.removeOneTitle')}
                testID="voice-storage-remove"
              >
                <TrashIcon width={20} height={20} colorClassName="text-gray-6" />
              </PressableFeedback>
            </HStack>
          ))}
        </SettingsCard>
      )}

      {usage.notes.length > 0 && (
        <Button
          variant="weak"
          color="danger"
          onPress={handleRemoveAll}
          testID="voice-storage-remove-all"
        >
          {t('voiceStorage.removeAll')}
        </Button>
      )}
    </VStack>
  );
}

VoiceStorageScreen.Loading = function Loading() {
  return (
    <SettingsCard>
      <VStack gap={4}>
        <TextSkeleton size="b4" className="w-24" />
        <TextSkeleton size="t2" className="w-32" />
        <TextSkeleton size="b4" className="w-full" />
      </VStack>
    </SettingsCard>
  );
};

export default function VoiceStorageRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1 py-5" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <StyledSafeAreaView edges={['left', 'right']}>
          <QueryErrorBoundary>
            <Suspense fallback={<VoiceStorageScreen.Loading />}>
              <VoiceStorageScreen />
            </Suspense>
          </QueryErrorBoundary>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
