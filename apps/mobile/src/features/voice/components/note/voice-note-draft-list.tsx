import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, MicIcon, Text, VStack } from '@src/shared/ui';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { VoiceNote } from '../../domains/voice-note.model';
import { useVoiceNotes } from '../../hooks/use-voice-notes';
import { formatMediaTime } from '../../utils/format-media-time';
import { voiceNoteHref } from '../../utils/navigation/voice-note-href';

type VoiceNoteDraftListProps = Omit<ComponentProps<typeof VStack>, 'children'>;

/** 기기에 남아 있는 말로 메모. 녹음을 끝내거나 앱이 꺼져도 글자는 여기서 다시 연다 */
export function VoiceNoteDraftList(stackProps: VoiceNoteDraftListProps) {
  const { t } = useTranslation('voiceNote');
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const notes = useVoiceNotes(me.id);

  if (notes.length === 0) {
    return null;
  }

  return (
    <VStack gap={8} {...stackProps}>
      <Text size="b4" weight="semibold" shade={6}>
        {t('drafts.title')}
      </Text>
      {notes.map((note) => (
        <VoiceNoteDraftList.Item key={note.draftId} note={note} />
      ))}
    </VStack>
  );
}

VoiceNoteDraftList.Item = function Item({ note }: { note: VoiceNote }) {
  const { t } = useTranslation('voiceNote');
  const dateFormatContext = useDateFormatContext();
  const push = useSingleTap(router.push);
  const title =
    note.digest == null || note.digest.title === '' ? t('result.defaultTitle') : note.digest.title;

  return (
    <PressableFeedback
      onPress={() => push(voiceNoteHref(note.draftId))}
      accessibilityRole="button"
      className="rounded-2xl bg-gray-1 px-3 py-2.5"
      testID="voice-note-draft"
    >
      <HStack gap={10} align="center">
        <MicIcon width={20} height={20} colorClassName="text-gray-6" />
        <VStack flex={1} gap={2}>
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
        <Text size="e1" shade={note.digest == null ? 7 : 5} maxLines={1}>
          {note.digest == null ? t('drafts.notDigested') : t('drafts.digested')}
        </Text>
      </HStack>
    </PressableFeedback>
  );
};
