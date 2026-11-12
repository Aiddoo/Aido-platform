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
  MicIcon,
  Result,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
  SurfaceCard,
  LabelChip,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  useConfirmDialog,
} from '@src/shared/ui';
import { range } from 'es-toolkit';
import { Link, router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { ScrollView, StyleSheet } from 'react-native';

import { VOICE_NOTE_PREVIEW_COUNT } from '../../constants/voice-note.constants';
import { VoiceNotePolicy, type VoiceNote } from '../../domains/voice-note.model';
import { useVoiceNotes } from '../../hooks/use-voice-notes';
import { formatMediaTime } from '../../utils/media-time.view-model';

interface VoiceNoteDraftListProps {
  /** 미리 보일 개수. 넘으면 전체 보기로 전용 화면을 연다 */
  limit: number;
}

export function VoiceNoteDraftList({ limit }: VoiceNoteDraftListProps) {
  const { t } = useTranslation('voiceNote');
  const accountId = useSuspenseMyAccountId();
  const [notes] = useVoiceNotes(accountId);
  const push = useSingleTap(router.push);

  if (notes.length === 0) {
    return null;
  }

  return (
    <VStack gap={8}>
      <HStack align="center" justify="between" gap={8}>
        <Text size="b4" weight="semibold" shade={6}>
          {t('drafts.title')}
        </Text>
        {notes.length > limit && (
          <TextButton
            size="small"
            variant="arrow"
            hitSlop={12}
            onPress={() => push('/voice-notes')}
            testID="voice-note-draft-all"
          >
            {t('drafts.viewAll', { amount: notes.length })}
          </TextButton>
        )}
      </HStack>
      {notes.slice(0, limit).map((note) => (
        <VoiceNoteDraftList.Item key={note.draftId} note={note} />
      ))}
    </VStack>
  );
}

/** 전용 화면의 전체 목록. 30일 동안 쌓이면 많아질 수 있어 가상화한다 */
VoiceNoteDraftList.All = function All() {
  const { t } = useTranslation('voiceNote');
  const accountId = useSuspenseMyAccountId();
  const [notes] = useVoiceNotes(accountId);

  return (
    <FlashList
      data={notes}
      keyExtractor={(note) => note.draftId}
      renderItem={({ item }) => (
        <Box className="pb-2">
          <VoiceNoteDraftList.Item note={item} />
        </Box>
      )}
      ListEmptyComponent={<Result title={t('drafts.empty')} className="py-10" />}
      contentContainerStyle={styles.allContent}
      contentInsetAdjustmentBehavior="automatic"
    />
  );
};

VoiceNoteDraftList.Item = function Item({ note }: { note: VoiceNote }) {
  const { t } = useTranslation('voiceNote');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  // Link가 navigate로 열어 같은 초안은 한 번만 쌓인다. 메뉴의 열기도 같은 동사여야 겹쳐 쌓이지 않는다
  const navigate = useSingleTap(router.navigate);
  const deleteDraft = useDeleteVoiceNoteDraft(note);
  const title = VoiceNotePolicy.findDigestTitle(note) ?? t('result.defaultTitle');
  const href = { pathname: '/voice-notes/[draftId]', params: { draftId: note.draftId } } as const;

  return (
    <Link href={href} asChild>
      <Link.Trigger>
        <PressableFeedback
          accessibilityRole="button"
          className="rounded-2xl bg-gray-1 px-3 py-3"
          testID="voice-note-draft"
        >
          <HStack gap={12} align="center">
            <Box className="size-10 items-center justify-center rounded-full bg-gray-2">
              <MicIcon width={20} height={20} colorClassName="text-gray-7" />
            </Box>
            <VStack flex={1} gap={4}>
              <Text size="b3" weight="medium" numberOfLines={1}>
                {title}
              </Text>
              <Text size="e1" shade={6} numberOfLines={1} className="tabular-nums">
                {t('result.meta', {
                  date: formatYearAwareDateLabel(note.createdAt, todayKey, dateFormatContext),
                  duration: formatMediaTime(note.durationMs),
                })}
              </Text>
            </VStack>
            {/* Chip도 Pressable이라 그대로 두면 칩 자리 탭을 가로채 줄이 눌리지 않는다 */}
            {note.digest == null && (
              <LabelChip color="accent" label={t('drafts.notDigested')} pointerEvents="none" />
            )}
          </HStack>
        </PressableFeedback>
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction icon="doc.text" onPress={() => navigate(href)}>
          {t('drafts.open')}
        </Link.MenuAction>
        <Link.MenuAction icon="trash" destructive onPress={deleteDraft}>
          {t('result.delete')}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
  );
};

VoiceNoteDraftList.Loading = function Loading() {
  return (
    <ScrollView
      contentContainerStyle={styles.allContent}
      contentInsetAdjustmentBehavior="automatic"
      scrollEnabled={false}
    >
      {range(VOICE_NOTE_PREVIEW_COUNT).map((index) => (
        <Box key={index} className="pb-2">
          <SurfaceCard className="flex-row items-center gap-3 px-3 py-3">
            <Skeleton className="size-10 rounded-full" />
            <VStack flex={1} gap={4}>
              <TextSkeleton size="b3" className="w-1/2" />
              <TextSkeleton size="e1" className="w-1/3" />
            </VStack>
          </SurfaceCard>
        </Box>
      ))}
    </ScrollView>
  );
};

VoiceNoteDraftList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('voiceNote');

  return (
    <VStack flex={1} p={24} justify="center">
      <Result title={t('drafts.loadFailed')} button={<QueryErrorActions onRetry={reset} />} />
    </VStack>
  );
};

/** 상세 툴바의 삭제와 같은 확인을 거쳐 기기에서 초안·녹음을 지운다 */
function useDeleteVoiceNoteDraft(note: VoiceNote) {
  const { t } = useTranslation('voiceNote');
  const { trackEvent } = useTrack();
  const accountId = useSuspenseMyAccountId();
  const storage = useVoiceNoteStorageService();
  const confirmDialog = useConfirmDialog();

  return async () => {
    const isConfirmed = await confirmDialog.openAsync({
      title: t('result.deleteTitle'),
      description: t('result.deleteDescription'),
      confirmLabel: t('result.deleteConfirm'),
      confirmColor: 'danger',
      cancelLabel: t('result.deleteCancel'),
    });
    if (isConfirmed) {
      trackEvent('voice_note_deleted', { is_digested: VoiceNotePolicy.isDigested(note) });
      storage.discard(accountId, note.draftId);
    }
  };
}

const styles = StyleSheet.create({
  allContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
});
