import { FlashList } from '@shopify/flash-list';
import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { VoiceNotePolicy } from '@src/features/voice/domains/voice-note.model';
import type { VoiceNote } from '@src/features/voice/schemas/voice-note.schema';
import { formatMediaTime } from '@src/features/voice/utils/format-media-time';
import { useTrack } from '@src/shared/analytics';
import { formatDateLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HStack,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  Result,
  SettingsListGroup,
  SettingsScreenLayout,
  StyledSafeAreaView,
  Text,
  TextSkeleton,
  TrashIcon,
  useConfirmDialog,
  VStack,
  IconButton,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatFileSize } from '@src/shared/utils/number-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { type PropsWithChildren, Suspense, useState } from 'react';

function VoiceStorageScreen() {
  const { t } = useTranslation('settings');
  const { trackEvent } = useTrack();
  const dateFormatContext = useDateFormatContext();
  const confirmDialog = useConfirmDialog();
  // 저장 용량은 기기의 동기 값이라 쿼리 없이 읽고, 기다리는 것은 계정(me)뿐이다
  const storage = useVoiceNoteStorageService();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  // 파일 크기는 구독할 수 없어 화면에 들어올 때와 이 화면에서 지운 뒤에만 다시 읽는다.
  // 녹음은 이 화면 밖(녹음 화면)에서만 늘어나 이 화면이 떠 있는 동안 바뀌지 않는다
  const [usage, setUsage] = useState(() => storage.getRecordingUsage(me.id));

  const confirmRemoval = (title: string) =>
    confirmDialog.openAsync({
      title,
      description: t('voiceStorage.removeDescription'),
      confirmLabel: t('voiceStorage.removeConfirm'),
      confirmColor: 'danger',
      cancelLabel: t('voiceStorage.removeCancel'),
    });

  const handleRemoveOne = async (draftId: string) => {
    if (await confirmRemoval(t('voiceStorage.removeOneTitle'))) {
      storage.removeRecordings(me.id, draftId);
      setUsage(storage.getRecordingUsage(me.id));
      trackEvent('settings_changed', { setting: 'voice_storage', value: 'remove_one' });
    }
  };

  const handleRemoveAll = async () => {
    if (await confirmRemoval(t('voiceStorage.removeAllTitle'))) {
      storage.removeAllRecordings(me.id);
      setUsage(storage.getRecordingUsage(me.id));
      trackEvent('settings_changed', { setting: 'voice_storage', value: 'remove_all' });
    }
  };

  // 확인 창이 뜨기 전에 한 번 더 눌러도 창이 두 번 열리지 않게 한다
  const removeOne = useSingleTap(handleRemoveOne);
  const removeAll = useSingleTap(handleRemoveAll);

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <FlashList
        data={usage.notes}
        keyExtractor={({ note }) => note.draftId}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <VoiceStorageScreen.Gutter className="pt-5 pb-3">
            <SettingsListGroup>
              <SettingsListGroup.Content gap={4}>
                <Text size="b4" shade={6}>
                  {t('voiceStorage.totalLabel')}
                </Text>
                <Text size="t2" weight="bold" className="tabular-nums" testID="voice-storage-total">
                  {formatFileSize(usage.totalBytes, dateFormatContext.locale)}
                </Text>
                <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
                  {t('voiceStorage.description')}
                </Text>
              </SettingsListGroup.Content>
            </SettingsListGroup>
          </VoiceStorageScreen.Gutter>
        }
        ListEmptyComponent={
          <Result title={t('voiceStorage.empty')} className="py-10" testID="voice-storage-empty" />
        }
        renderItem={({ item: { note, bytes }, index }) => (
          <VoiceStorageScreen.Gutter>
            <Box
              className={cn(
                'bg-gray-1',
                index === 0 && 'rounded-t-2xl',
                index === usage.notes.length - 1 && 'rounded-b-2xl',
              )}
            >
              {index > 0 && <SettingsListGroup.Separator />}
              <VoiceStorageScreen.Row
                note={note}
                bytes={bytes}
                onRemove={() => removeOne(note.draftId)}
              />
            </Box>
          </VoiceStorageScreen.Gutter>
        )}
        ListFooterComponent={
          usage.notes.length > 0 ? (
            <VoiceStorageScreen.Gutter className="pt-3 pb-4">
              <Button
                variant="weak"
                color="danger"
                onPress={removeAll}
                testID="voice-storage-remove-all"
              >
                {t('voiceStorage.removeAll')}
              </Button>
            </VoiceStorageScreen.Gutter>
          ) : undefined
        }
      />
    </StyledSafeAreaView>
  );
}

/** 가상 목록은 헤더·행·꼬리가 따로 그려져 행마다 `SettingsScreenLayout`과 같은 안쪽 여백을 둔다 */
VoiceStorageScreen.Gutter = function Gutter({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <StyledSafeAreaView edges={['left', 'right']}>
      <ReadableContent className={cn('px-4', className)}>{children}</ReadableContent>
    </StyledSafeAreaView>
  );
};

VoiceStorageScreen.Row = function Row({
  note,
  bytes,
  onRemove,
}: {
  note: VoiceNote;
  bytes: number;
  onRemove: () => void;
}) {
  const { t } = useTranslation('settings');
  const { t: tVoiceNote } = useTranslation('voiceNote');
  const dateFormatContext = useDateFormatContext();

  return (
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
      <IconButton
        accessibilityLabel={t('voiceStorage.removeOneTitle')}
        icon={<TrashIcon width={20} height={20} colorClassName="text-gray-6" />}
        className="min-h-0 min-w-0"
        hitSlop={12}
        testID="voice-storage-remove"
        onPress={onRemove}
      />
    </HStack>
  );
};

VoiceStorageScreen.Loading = function Loading() {
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

VoiceStorageScreen.Error = function ErrorFallback(props: QueryErrorFallbackProps) {
  return (
    <SettingsScreenLayout>
      <SettingsListGroup.Error {...props} />
    </SettingsScreenLayout>
  );
};

export default function VoiceStorageRoute() {
  return (
    <QueryErrorBoundary fallback={VoiceStorageScreen.Error}>
      <Suspense fallback={<VoiceStorageScreen.Loading />}>
        <VoiceStorageScreen />
      </Suspense>
    </QueryErrorBoundary>
  );
}
