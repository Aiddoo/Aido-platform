import { FlashList } from '@shopify/flash-list';
import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { formatDateLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  ReadableContent,
  Result,
  SettingsListGroup,
  SettingsScreenLayout,
  StyledSafeAreaView,
  Text,
  TextSkeleton,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatFileSize } from '@src/shared/utils/number-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { VoiceNotePolicy } from '../../domains/voice-note.model';
import { formatMediaTime } from '../../utils/format-media-time';
import { RemoveRecordingButton } from './remove-recording-button';

/** 기기에 남긴 녹음 용량과 노트별 녹음. 가상 목록이라 헤더·행·꼬리마다 `SettingsScreenLayout`과 같은 안쪽 여백을 둔다 */
export function VoiceStorageUsage() {
  const { t } = useTranslation('settings');
  const { t: tVoiceNote } = useTranslation('voiceNote');
  const dateFormatContext = useDateFormatContext();
  // 저장 용량은 기기의 동기 값이라 쿼리 없이 읽고, 기다리는 것은 계정(me)뿐이다
  const storage = useVoiceNoteStorageService();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  // 파일 크기는 구독할 수 없어 화면에 들어올 때와 이 화면에서 지운 뒤에만 다시 읽는다.
  // 녹음은 이 화면 밖(녹음 화면)에서만 늘어나 이 화면이 떠 있는 동안 바뀌지 않는다
  const [usage, setUsage] = useState(() => storage.getRecordingUsage(me.id));
  const refreshUsage = () => setUsage(storage.getRecordingUsage(me.id));

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <FlashList
        data={usage.notes}
        keyExtractor={({ note }) => note.draftId}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <StyledSafeAreaView edges={['left', 'right']}>
            <ReadableContent className="px-4 pb-3 pt-5">
              <SettingsListGroup>
                <SettingsListGroup.Content gap={4}>
                  <Text size="b4" shade={6}>
                    {t('voiceStorage.totalLabel')}
                  </Text>
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
                </SettingsListGroup.Content>
              </SettingsListGroup>
            </ReadableContent>
          </StyledSafeAreaView>
        }
        ListEmptyComponent={
          <Result title={t('voiceStorage.empty')} className="py-10" testID="voice-storage-empty" />
        }
        renderItem={({ item: { note, bytes }, index }) => (
          <StyledSafeAreaView edges={['left', 'right']}>
            <ReadableContent className="px-4">
              <Box
                className={cn(
                  'bg-gray-1',
                  index === 0 && 'rounded-t-2xl',
                  index === usage.notes.length - 1 && 'rounded-b-2xl',
                )}
              >
                {index > 0 && <SettingsListGroup.Separator />}
                <HStack gap={12} align="center" px={16} py={12} testID="voice-storage-row">
                  <VStack flex={1} gap={2}>
                    <Text size="b3" weight="medium" numberOfLines={1}>
                      {VoiceNotePolicy.findDigestTitle(note) ?? tVoiceNote('result.defaultTitle')}
                    </Text>
                    <Text size="e1" shade={6} numberOfLines={1} className="tabular-nums">
                      {tVoiceNote('result.meta', {
                        date: formatDateLabel(note.createdAt, 'monthDay', dateFormatContext),
                        duration: formatMediaTime(note.durationMs),
                      })}
                    </Text>
                  </VStack>
                  <Text size="b4" shade={7} numberOfLines={1} className="tabular-nums">
                    {formatFileSize(bytes, dateFormatContext.locale)}
                  </Text>
                  <RemoveRecordingButton draftId={note.draftId} onRemoved={refreshUsage} />
                </HStack>
              </Box>
            </ReadableContent>
          </StyledSafeAreaView>
        )}
        ListFooterComponent={
          usage.notes.length > 0 ? (
            <StyledSafeAreaView edges={['left', 'right']}>
              <ReadableContent className="px-4 pb-4 pt-3">
                <RemoveRecordingButton onRemoved={refreshUsage} />
              </ReadableContent>
            </StyledSafeAreaView>
          ) : undefined
        }
      />
    </StyledSafeAreaView>
  );
}

VoiceStorageUsage.Loading = function Loading() {
  return (
    <SettingsScreenLayout scrollEnabled={false}>
      <SettingsListGroup>
        <SettingsListGroup.Content gap={4}>
          <TextSkeleton size="b4" className="w-24" />
          <TextSkeleton size="t2" className="w-32" />
          <TextSkeleton size="b4" className="w-full" />
        </SettingsListGroup.Content>
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
