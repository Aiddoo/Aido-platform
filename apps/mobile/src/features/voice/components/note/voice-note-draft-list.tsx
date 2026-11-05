import { FlashList } from '@shopify/flash-list';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, MicIcon, Result, Text, TextButton, VStack } from '@src/shared/ui';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Chip, PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

import { VOICE_NOTE_PREVIEW_COUNT } from '../../constants/voice-note.constants';
import { type VoiceNote, VoiceNotePolicy } from '../../domains/voice-note.model';
import { useVoiceNotes } from '../../hooks/use-voice-notes';
import { formatMediaTime } from '../../utils/format-media-time';
import { voiceNoteHref, voiceNoteListHref } from '../../utils/navigation/voice-note-href';

type VoiceNoteDraftListProps = Omit<ComponentProps<typeof VStack>, 'children'>;

/** 기기에 남아 있는 말로 메모. 녹음을 끝내거나 앱이 꺼져도 글자는 여기서 다시 연다 */
export function VoiceNoteDraftList(stackProps: VoiceNoteDraftListProps) {
  const { t } = useTranslation('voiceNote');
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const notes = useVoiceNotes(me.id);
  const push = useSingleTap(router.push);

  if (notes.length === 0) {
    return null;
  }

  return (
    <VStack gap={8} {...stackProps}>
      <HStack align="center" justify="between" gap={8}>
        <Text size="b4" weight="semibold" shade={6}>
          {t('drafts.title')}
        </Text>
        {notes.length > VOICE_NOTE_PREVIEW_COUNT && (
          <TextButton
            size="small"
            variant="arrow"
            hitSlop={12}
            onPress={() => push(voiceNoteListHref())}
            testID="voice-note-draft-all"
          >
            {t('drafts.viewAll', { amount: notes.length })}
          </TextButton>
        )}
      </HStack>
      {notes.slice(0, VOICE_NOTE_PREVIEW_COUNT).map((note) => (
        <VoiceNoteDraftList.Item key={note.draftId} note={note} />
      ))}
    </VStack>
  );
}

/** 전용 화면의 전체 목록. 30일 동안 쌓이면 많아질 수 있어 가상화한다 */
VoiceNoteDraftList.All = function All() {
  const { t } = useTranslation('voiceNote');
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const notes = useVoiceNotes(me.id);

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
  const push = useSingleTap(router.push);
  const title = VoiceNotePolicy.getDigestTitle(note) ?? t('result.defaultTitle');

  return (
    <PressableFeedback
      onPress={() => push(voiceNoteHref(note.draftId))}
      accessibilityRole="button"
      className="rounded-2xl bg-gray-1 px-3 py-3"
      testID="voice-note-draft"
    >
      <HStack gap={12} align="center">
        <Box className="size-10 items-center justify-center rounded-full bg-gray-2">
          <MicIcon width={20} height={20} colorClassName="text-gray-7" />
        </Box>
        <VStack flex={1} gap={4}>
          <Text size="b3" weight="medium" maxLines={1}>
            {title}
          </Text>
          <Text size="e1" shade={6} maxLines={1} className="tabular-nums">
            {t('result.meta', {
              date: formatDateLabel(note.createdAt, 'monthDay', dateFormatContext),
              duration: formatMediaTime(note.durationMs),
            })}
          </Text>
        </VStack>
        {note.digest == null && (
          <Chip size="sm" variant="soft" color="accent">
            <Chip.Label>{t('drafts.notDigested')}</Chip.Label>
          </Chip>
        )}
      </HStack>
    </PressableFeedback>
  );
};

const styles = StyleSheet.create({
  allContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
});
