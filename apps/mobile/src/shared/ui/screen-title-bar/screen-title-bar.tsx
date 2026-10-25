import { useTranslation } from '@src/shared/i18n';
import { PressableFeedback } from 'heroui-native';

import { HStack } from '../h-stack/h-stack';
import { ArrowLeftIcon } from '../icon';
import { Text } from '../text/text';
import { VStack } from '../v-stack/v-stack';
import type { ScreenTitleBarProps } from './screen-title-bar.types';

/**
 * Stack 화면이 아닌 pane(AdaptivePane 상세) 꼭대기의 제목 바 — 뒤로가기 · 가운데 제목.
 * Stack 화면은 네이티브 헤더(`useStackScreenOptions`)를 쓴다.
 */
export function ScreenTitleBar({
  title,
  subtitle,
  onBackPress,
  backAccessibilityLabel,
  isBackDisabled = false,
  right,
}: ScreenTitleBarProps) {
  const { t } = useTranslation('common');

  return (
    <HStack px={16} py={10} align="center" justify="between">
      <PressableFeedback
        onPress={onBackPress}
        isDisabled={isBackDisabled}
        hitSlop={8}
        className="size-11 items-center justify-center rounded-full"
        accessibilityRole="button"
        accessibilityLabel={backAccessibilityLabel ?? t('actions.goBack')}
        accessibilityState={{ disabled: isBackDisabled }}
      >
        <ArrowLeftIcon width={22} height={22} colorClassName="text-gray-9" />
      </PressableFeedback>

      <ScreenTitleBar.Title title={title} subtitle={subtitle} />

      {/* 오른쪽이 비어도 제목이 가운데에 남도록 같은 폭을 차지한다. */}
      <HStack className="size-11 items-center justify-center">{right}</HStack>
    </HStack>
  );
}

/** 제목과 보조 문구. 네이티브 헤더의 `headerTitle`로도 쓴다. */
ScreenTitleBar.Title = function Title({
  title,
  subtitle,
}: Pick<ScreenTitleBarProps, 'title' | 'subtitle'>) {
  return (
    <VStack align="center" gap={1}>
      <Text size="b2" weight="bold">
        {title}
      </Text>
      {subtitle != null && (
        <Text size="e1" shade={5}>
          {subtitle}
        </Text>
      )}
    </VStack>
  );
};
