import { FlashList } from '@shopify/flash-list';
import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useTrack } from '@src/shared/analytics';
import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  ReadableContent,
  SettingsListGroup,
  SettingsScreenLayout,
  StyledSafeAreaView,
  Text,
  TextSkeleton,
  VStack,
  type QueryErrorFallbackProps,
  Button,
  IconButton,
  MemoIllustration,
  TrashIcon,
  useConfirmDialog,
} from '@src/shared/ui';
import { formatFileSize } from '@src/shared/utils/number-format';
import { useState } from 'react';

import { VoiceNotePolicy } from '../domains/voice-note.model';
import { formatMediaTime } from '../utils/media-time.view-model';

/** 기기에 남긴 녹음 용량과 노트별 녹음. 가상 목록이라 헤더·행·꼬리마다 `SettingsScreenLayout`과 같은 안쪽 여백을 둔다 */
export function VoiceStorageUsage() {
  const { t } = useTranslation('settings');
  const { t: tVoiceNote } = useTranslation('voiceNote');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  // 저장 용량은 기기의 동기 값이라 쿼리 없이 읽고, 기다리는 것은 계정(me)뿐이다
  const storage = useVoiceNoteStorageService();
  const accountId = useSuspenseMyAccountId();
  // 파일 크기는 구독할 수 없지만 녹음은 이 화면 밖에서만 늘어 들어올 때와 지운 뒤에만 다시 읽는다
  const [usage, setUsage] = useState(() => storage.getRecordingUsage(accountId));
  const refreshUsage = () => setUsage(storage.getRecordingUsage(accountId));

  return (
    <Box flex={1} className="bg-white">
      <FlashList
        data={usage.notes}
        keyExtractor={({ note }) => note.draftId}
        // 화면이 아래 safe area를 빼지 않아 iOS가 탭 막대·홈 인디케이터만큼 끝을 띄우고 행은 유리 밑으로 스크롤된다
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <StyledSafeAreaView edges={['left', 'right']}>
            <ReadableContent className="px-4 pt-5 pb-3">
              <SettingsListGroup label={t('voiceStorage.totalLabel')}>
                <SettingsListGroup.Custom gap={4}>
                  <Text
                    size="t2"
                    weight="bold"
                    className="tabular-nums"
                    testID="voice-storage-total"
                  >
                    {formatFileSize(usage.totalBytes, dateFormatContext.locale)}
                  </Text>
                  <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
                    {t('voiceStorage.description')}
                  </Text>
                </SettingsListGroup.Custom>
              </SettingsListGroup>
            </ReadableContent>
          </StyledSafeAreaView>
        }
        ListEmptyComponent={
          <StyledSafeAreaView edges={['left', 'right']}>
            <ReadableContent className="px-4">
              <SettingsListGroup.Empty
                icon={<MemoIllustration size="block" />}
                title={t('voiceStorage.empty')}
                description={t('voiceStorage.emptyDescription')}
                testID="voice-storage-empty"
              />
            </ReadableContent>
          </StyledSafeAreaView>
        }
        renderItem={({ item: { note, bytes }, index }) => (
          <StyledSafeAreaView edges={['left', 'right']}>
            <ReadableContent className="px-4">
              <SettingsListGroup.Segment
                label={t('voiceStorage.listLabel')}
                isFirst={index === 0}
                isLast={index === usage.notes.length - 1}
              >
                <HStack
                  gap={12}
                  align="center"
                  className="min-h-12 px-4 py-3"
                  testID="voice-storage-row"
                >
                  <VStack flex={1} gap={2}>
                    <Text size="b2" shade={8} numberOfLines={1}>
                      {VoiceNotePolicy.findDigestTitle(note) ?? tVoiceNote('result.defaultTitle')}
                    </Text>
                    <Text size="b4" shade={6} numberOfLines={1} className="tabular-nums">
                      {tVoiceNote('result.meta', {
                        date: formatYearAwareDateLabel(note.createdAt, todayKey, dateFormatContext),
                        duration: formatMediaTime(note.durationMs),
                      })}
                    </Text>
                  </VStack>
                  <Text size="b4" shade={7} numberOfLines={1} className="tabular-nums">
                    {formatFileSize(bytes, dateFormatContext.locale)}
                  </Text>
                  <RemoveRecordingButton draftId={note.draftId} onRemoved={refreshUsage} />
                </HStack>
              </SettingsListGroup.Segment>
            </ReadableContent>
          </StyledSafeAreaView>
        )}
        ListFooterComponent={
          usage.notes.length > 0 ? (
            <StyledSafeAreaView edges={['left', 'right']}>
              <ReadableContent className="px-4 pt-3 pb-4">
                <RemoveRecordingButton onRemoved={refreshUsage} />
              </ReadableContent>
            </StyledSafeAreaView>
          ) : undefined
        }
      />
    </Box>
  );
}

VoiceStorageUsage.Loading = function Loading() {
  const { t } = useTranslation('settings');

  return (
    <SettingsScreenLayout scrollEnabled={false}>
      <SettingsListGroup label={t('voiceStorage.totalLabel')}>
        <SettingsListGroup.Custom gap={4}>
          <TextSkeleton size="t2" className="w-32" />
          <TextSkeleton size="b4" className="w-full" />
        </SettingsListGroup.Custom>
      </SettingsListGroup>
    </SettingsScreenLayout>
  );
};

VoiceStorageUsage.Error = function ErrorFallback(props: QueryErrorFallbackProps) {
  return (
    <SettingsScreenLayout>
      <SettingsListGroup.Error {...props} />
    </SettingsScreenLayout>
  );
};

interface RemoveRecordingButtonProps {
  /** 없으면 모든 녹음을 지운다 */
  draftId?: string;
  onRemoved: () => void;
}

/** 확인을 받은 뒤 기기에 남긴 녹음 파일을 지운다. 지운 뒤 용량은 부모가 `onRemoved`에서 다시 읽는다 */
function RemoveRecordingButton({ draftId, onRemoved }: RemoveRecordingButtonProps) {
  const { t } = useTranslation('settings');
  const { trackEvent } = useTrack();
  const confirmDialog = useConfirmDialog();
  const storage = useVoiceNoteStorageService();
  const accountId = useSuspenseMyAccountId();

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
      storage.removeAllRecordings(accountId);
    } else {
      storage.removeRecordings(accountId, draftId);
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
