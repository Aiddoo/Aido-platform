import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { useSystemFontScaledSize } from '@src/shared/hooks/use-system-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  HStack,
  type HintPopoverContentProps,
  MicIcon,
  Text,
  useAdaptivePaneLayoutKey,
} from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';

import { useStartVoiceNote } from '../../hooks/use-start-voice-note';

interface VoiceNoteStartButtonProps {
  coachmarkPlacement: HintPopoverContentProps['placement'];
  coachmarkOffset?: HintPopoverContentProps['offset'];
}

export function VoiceNoteStartButton({
  coachmarkPlacement,
  coachmarkOffset,
}: VoiceNoteStartButtonProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useSystemFontScaledSize();
  const start = useStartVoiceNote();
  const layoutKey = useAdaptivePaneLayoutKey();

  return (
    <CoachmarkPopover
      kind="voice-note-start"
      title={t('coach.noteStart.title')}
      description={t('coach.noteStart.description')}
      dismissKey={layoutKey}
      placement={coachmarkPlacement}
      offset={coachmarkOffset}
      align="center"
      avoidCollisions
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
