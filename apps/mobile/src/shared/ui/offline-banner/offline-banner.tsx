import { ANIMATION } from '@src/shared/constants/animation';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { HStack } from '../h-stack/h-stack';
import { InfoIcon } from '../icon/icons';
import { StyledSafeAreaView } from '../styled-safe-area-view/styled-safe-area-view';
import { Text } from '../text/text';

const ICON_SIZE = 16;

/** 루트에 한 번만 두고, 아래 내용은 별도 SafeAreaProvider로 감싸 상태 표시줄 inset을 배너가 대신 차지하게 한다 */
export function OfflineBanner() {
  const isOnline = useIsOnline();
  const { t } = useTranslation('common');
  const fontScaledSize = useFontScaledSize();
  const message = t('offlineBanner.message');

  useEffect(() => {
    if (!isOnline) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [isOnline, message]);

  if (isOnline) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION.duration.normal).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(ANIMATION.duration.fast).reduceMotion(ReduceMotion.System)}
    >
      <StyledSafeAreaView edges={['top', 'left', 'right']} className="bg-gray-2">
        <HStack
          align="center"
          className="gap-1.5 px-4 py-2"
          accessible
          accessibilityRole="text"
          accessibilityLabel={message}
          testID="offline-banner"
        >
          <InfoIcon
            width={fontScaledSize(ICON_SIZE)}
            height={fontScaledSize(ICON_SIZE)}
            colorClassName="text-gray-8"
          />
          <Text size="b4" weight="medium" className="text-gray-9 shrink">
            {message}
          </Text>
        </HStack>
      </StyledSafeAreaView>
    </Animated.View>
  );
}
