import { ANIMATION } from '@src/shared/constants/animation';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { Box, CloseIcon, FeatureMedia, H3, HStack, Spacing, Text } from '@src/shared/ui';
import { Chip, CloseButton, PressableFeedback } from 'heroui-native';
import { type ReactNode, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';

const MEDIA_RATIO = 3 / 4;
const MEDIA_MIN_HEIGHT = 160;
const CLOSE_ICON_SIZE = 22;

interface WhatsNewStepProps {
  media: ReactNode;
  title: string;
  description: string;
  /** 없으면 소개만 하고 바로 써 보기를 두지 않는다 */
  actionLabel?: string;
  onAction?: () => void;
}

export function WhatsNewStep({
  media,
  title,
  description,
  actionLabel,
  onAction,
}: WhatsNewStepProps) {
  const isReducedMotion = useIsReduceMotionEnabled();
  const handleAction = useSingleTap(() => onAction?.());

  return (
    <Animated.View
      entering={isReducedMotion ? undefined : FadeIn.duration(ANIMATION.duration.normal)}
      style={{ flex: 1 }}
    >
      <ScrollView
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Box flex={1} style={{ minHeight: MEDIA_MIN_HEIGHT }}>
          {media}
        </Box>

        <Spacing size={24} />

        <H3>{title}</H3>

        <Spacing size={6} />

        <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
          {description}
        </Text>

        <Spacing size={4} />

        {actionLabel != null && (
          <PressableFeedback
            accessibilityRole="button"
            onPress={handleAction}
            testID="whats-new-step-action"
            className="min-h-11 justify-center self-start"
          >
            <Text size="b3" weight="semibold" tone="brand">
              {actionLabel}
            </Text>
          </PressableFeedback>
        )}
      </ScrollView>
    </Animated.View>
  );
}

WhatsNewStep.Header = function Header({ isNew, onClose }: { isNew: boolean; onClose: () => void }) {
  const { t } = useTranslation(['whatsNew', 'common']);

  return (
    <HStack align="center" justify="between">
      {isNew ? (
        <Chip size="sm" className="bg-highlight">
          <Text size="e1" weight="semibold" tone="brand">
            {t('list.newBadge')}
          </Text>
        </Chip>
      ) : (
        <Box />
      )}
      <CloseButton
        variant="ghost"
        testID="whats-new-close"
        className="size-11"
        accessibilityLabel={t('common:actions.close')}
        onPress={onClose}
      >
        <CloseIcon width={CLOSE_ICON_SIZE} height={CLOSE_ICON_SIZE} colorClassName="text-gray-6" />
      </CloseButton>
    </HStack>
  );
};

WhatsNewStep.Media = function Media({
  sources,
  alt,
}: {
  sources: Record<'ko' | 'en', Record<'light' | 'dark', number>>;
  alt: string;
}) {
  const { resolvedLanguage } = useLanguage();
  const { theme } = useUniwind();
  const [width, setWidth] = useState<number | null>(null);

  const handleLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setWidth(Math.min(layout.width, layout.height * MEDIA_RATIO));
  };

  return (
    <Box flex={1} onLayout={handleLayout}>
      {/* 흐름에 넣으면 잰 크기가 다음 측정의 최소 높이가 되어 자리가 줄어도 미디어가 줄지 않는다 */}
      {width != null && (
        <Box className="items-center justify-center" style={StyleSheet.absoluteFill}>
          <FeatureMedia
            ratio={MEDIA_RATIO}
            source={sources[resolvedLanguage][theme === 'dark' ? 'dark' : 'light']}
            alt={alt}
            contentFit="contain"
            className="rounded-3xl"
            style={{ width }}
          />
        </Box>
      )}
    </Box>
  );
};
