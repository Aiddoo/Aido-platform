import { CoachmarkPopover } from '@src/features/feature-discovery/components/coachmark-popover';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { HStack, MicIcon, Text } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';

import { useVoiceNoteStart } from '../../hooks/use-voice-note-start';

const CREATE_BUTTON_SIZE = 44;
/** 옆 새 메모 버튼까지의 간격 8 + 말풍선 기본 간격 9 */
const CREATE_BUTTON_CLEARANCE = 17;

export function VoiceNoteStartButton() {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const start = useVoiceNoteStart();
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <CoachmarkPopover
      kind="voice-note-start"
      title={t('coach.noteStart.title')}
      description={t('coach.noteStart.description')}
      // 아래로 펴면 첫 메모 카드를 덮는다. 좁은 화면은 가려도 잃는 것이 없는 제목 자리에 편다.
      // 넓은 화면은 그 자리가 좁아 글자가 찌그러지므로 새 메모 버튼을 지나 상세 칸에 편다
      placement={isCompact ? 'left' : 'right'}
      offset={isCompact ? undefined : fontScaledSize(CREATE_BUTTON_SIZE) + CREATE_BUTTON_CLEARANCE}
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
