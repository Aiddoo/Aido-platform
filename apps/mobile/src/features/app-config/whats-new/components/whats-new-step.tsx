import { ANIMATION } from '@src/shared/constants/animation';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, H3, HStack, STACK_CLOSE_ICON, Spacing, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Stack } from 'expo-router';
import { Chip, PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/** 큰 글꼴에서도 예시 화면이 알아볼 만큼 남는 높이. 더 줄면 글이 아니라 스크롤로 넘긴다 */
const MEDIA_MIN_HEIGHT = 240;

interface WhatsNewStepProps {
  media: ReactNode;
  title: string;
  description: string;
  /** 없으면 소개만 하고 바로 써 보기를 두지 않는다 */
  actionLabel?: string;
  onAction?: () => void;
  /** 그림만 있는 장면은 더 줄여 작은 화면에서도 제목이 아래 버튼에 밀리지 않게 한다 */
  mediaMinHeight?: number;
}

/** 큰 글꼴이나 작은 화면에서는 미디어가 먼저 줄고, 그래도 넘치면 스크롤해 바로 써 보기에 닿는다 */
export function WhatsNewStep({
  media,
  title,
  description,
  actionLabel,
  onAction,
  mediaMinHeight = MEDIA_MIN_HEIGHT,
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
        <Box flex={1} style={{ minHeight: mediaMinHeight }}>
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

interface HeaderProps {
  isNew: boolean;
  /** 패치 노트의 버전 */
  version: string;
  onClose: () => void;
}

/** 닫기는 흐름형 화면 규칙대로 네이티브 헤더 오른쪽(Duo 레일 포함)에 두고, 본문에는 새 기능 표시와 버전만 둔다 */
WhatsNewStep.Header = function Header({ isNew, version, onClose }: HeaderProps) {
  const { t } = useTranslation(['whatsNew', 'common']);

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={STACK_CLOSE_ICON}
          accessibilityLabel={t('common:actions.close')}
          onPress={onClose}
        />
      </Stack.Toolbar>
      <HStack align="center" gap={8}>
        {isNew && (
          <Chip size="sm" className="bg-highlight">
            <Text size="e1" weight="semibold" tone="brand">
              {t('list.newBadge')}
            </Text>
          </Chip>
        )}
        <Text size="e1" shade={6} accessibilityLabel={t('list.versionLabel', { version })}>
          {t('list.version', { version })}
        </Text>
      </HStack>
    </>
  );
};

interface StageProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  children: ReactNode;
}

WhatsNewStep.Stage = function Stage({ children, className, ...boxProps }: StageProps) {
  const { t } = useTranslation('whatsNew');

  return (
    <Box
      flex={1}
      className={cn('overflow-hidden rounded-3xl bg-highlight px-3 pt-3', className)}
      {...boxProps}
    >
      <Chip size="sm" variant="secondary" className="self-start bg-white/70">
        <Text size="e2" weight="semibold" shade={7}>
          {t('stage.badge')}
        </Text>
      </Chip>
      <Spacing size={8} />
      <Box flex={1} className="overflow-hidden rounded-t-3xl bg-white">
        {/* 예시가 길어도 무대 높이를 늘리지 않고 잘린다. 늘면 큰 글꼴에서 제목·설명이 화면 밖으로 밀린다 */}
        <Box className="absolute inset-0 px-4 pt-2">
          <Box className="h-1 w-9 self-center rounded-full bg-gray-3" />
          <Spacing size={12} />
          {children}
        </Box>
      </Box>
    </Box>
  );
};
