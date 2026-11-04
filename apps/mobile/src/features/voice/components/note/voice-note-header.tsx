import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, CloseIcon, HStack, Text } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

interface VoiceNoteHeaderProps extends Omit<ComponentProps<typeof HStack>, 'children'> {
  title?: string;
  onClose: () => void;
  /** 오른쪽 끝(언어 고르기·메모로 저장) */
  right?: ReactNode;
}

/** 말로 메모하기 화면들의 위쪽 줄. 닫기 왼쪽, 제목 가운데, 오른쪽 동작 */
export function VoiceNoteHeader({ title, onClose, right, ...stackProps }: VoiceNoteHeaderProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();

  return (
    <HStack align="center" gap={8} {...stackProps}>
      <PressableFeedback
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('record.close')}
        testID="voice-note-close"
      >
        <CloseIcon
          width={fontScaledSize(22)}
          height={fontScaledSize(22)}
          colorClassName="text-gray-7"
        />
      </PressableFeedback>
      <Box flex={1}>
        {title != null && (
          <Text size="b2" weight="semibold" align="center" maxLines={1}>
            {title}
          </Text>
        )}
      </Box>
      {right}
    </HStack>
  );
}
