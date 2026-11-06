import { CoachmarkPopover } from '@src/features/feature-discovery/components/coachmark-popover';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { HStack, MicIcon, Text } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';

import { useVoiceNoteStart } from '../../hooks/use-voice-note-start';

export function VoiceNoteStartButton() {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const start = useVoiceNoteStart();

  return (
    <CoachmarkPopover
      kind="voice-note-start"
      title={t('coach.noteStart.title')}
      description={t('coach.noteStart.description')}
      placement="bottom"
      isPassThrough
    >
      <PressableFeedback
        onPress={() => start()}
        accessibilityRole="button"
        accessibilityLabel={t('start.label')}
        style={{ height: fontScaledSize(44) }}
        className="justify-center rounded-full bg-gray-2 px-4"
        testID="voice-note-start"
      >
        <HStack gap={6} align="center">
          <MicIcon width={20} height={20} colorClassName="text-gray-8" />
          <Text size="b4" weight="semibold" shade={8} maxLines={1}>
            {t('start.shortLabel')}
          </Text>
        </HStack>
      </PressableFeedback>
    </CoachmarkPopover>
  );
}
