import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { Box, CloseIcon, HStack } from '@src/shared/ui';
import { CloseButton } from 'heroui-native';
import type { ReactNode } from 'react';

interface QuickVoiceHeaderProps {
  center: ReactNode;
  right?: ReactNode;
  onClose: () => void;
}

/**
 * 빠른 말하기 시트의 위쪽 줄. 시트는 Stack 화면이 아니라 네이티브 헤더가 없다.
 * 좁은 창에서는 오른쪽이 넓어 양쪽을 같은 폭으로 맞출 수 없으니 남는 자리의 가운데에 둔다.
 */
export function QuickVoiceHeader({ center, right, onClose }: QuickVoiceHeaderProps) {
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <HStack align="center" gap={8}>
      <Box flex={isCompact ? undefined : 1} className="items-start">
        <CloseButton
          variant="ghost"
          style={{ width: fontScaledSize(22), height: fontScaledSize(22) }}
          onPress={onClose}
          accessibilityLabel={t('listening.cancel')}
          testID="quick-voice-cancel"
        >
          <CloseIcon
            width={fontScaledSize(22)}
            height={fontScaledSize(22)}
            colorClassName="text-gray-7"
          />
        </CloseButton>
      </Box>
      <Box flex={isCompact ? 1 : undefined} className="items-center">
        {center}
      </Box>
      <Box flex={isCompact ? undefined : 1} className="shrink items-end">
        {right}
      </Box>
    </HStack>
  );
}
