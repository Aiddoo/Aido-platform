import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { Box, CloseIcon, HStack, Text } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

interface VoiceNoteHeaderProps extends Omit<ComponentProps<typeof HStack>, 'children'> {
  title?: string;
  /** 제목 대신 가운데에 둘 내용(시계·진행 상태) */
  center?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  closeTestID?: string;
  /** 오른쪽 끝(언어 고르기·메모로 저장) */
  right?: ReactNode;
}

/**
 * 말로 메모하기와 빠른 말하기의 위쪽 줄. 닫기 왼쪽, 제목 가운데, 오른쪽 동작.
 * 좁은 창에서는 오른쪽이 넓어 양쪽을 같은 폭으로 맞출 수 없으니 남는 자리의 가운데에 둔다.
 */
export function VoiceNoteHeader({
  title,
  center,
  onClose,
  closeLabel,
  closeTestID = 'voice-note-close',
  right,
  ...stackProps
}: VoiceNoteHeaderProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <HStack align="center" gap={8} {...stackProps}>
      <Box flex={isCompact ? undefined : 1} className="items-start">
        <PressableFeedback
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={closeLabel ?? t('record.close')}
          testID={closeTestID}
        >
          <CloseIcon
            width={fontScaledSize(22)}
            height={fontScaledSize(22)}
            colorClassName="text-gray-7"
          />
        </PressableFeedback>
      </Box>
      <Box flex={isCompact ? 1 : undefined} className="items-center">
        {center ??
          (title != null && (
            <Text size="b2" weight="semibold" align="center" maxLines={1}>
              {title}
            </Text>
          ))}
      </Box>
      <Box flex={isCompact ? undefined : 1} className="items-end">
        {right}
      </Box>
    </HStack>
  );
}
