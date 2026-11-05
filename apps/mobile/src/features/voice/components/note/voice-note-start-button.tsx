import { CoachmarkPopover } from '@src/features/feature-discovery/components/coachmark-popover';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { MicIcon } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';

import { useVoiceNoteStart } from '../../hooks/use-voice-note-start';

/** 메모 탭 위쪽의 마이크. 메모 추가 버튼과 같은 크기로 나란히 둔다. 화면 맨 위라 안내는 아래로 연다 */
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
    >
      <PressableFeedback
        onPress={() => start()}
        accessibilityRole="button"
        accessibilityLabel={t('start.label')}
        style={{ width: fontScaledSize(44), height: fontScaledSize(44) }}
        className="items-center justify-center rounded-full bg-gray-2"
        testID="voice-note-start"
      >
        <MicIcon width={24} height={24} colorClassName="text-gray-7" />
      </PressableFeedback>
    </CoachmarkPopover>
  );
}
