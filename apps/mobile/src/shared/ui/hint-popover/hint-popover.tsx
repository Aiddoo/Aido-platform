import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Popover, usePopover } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HStack } from '../h-stack';
import { CloseIcon, type MicIcon } from '../icon';
import { Text } from '../text';
import { VStack } from '../v-stack';

/** 말풍선 폭. 좁은 화면에서는 화면 안으로 줄인다 */
const HINT_MAX_WIDTH = 300;
const HINT_SCREEN_INSET = 12;
/** `Popover.Content`의 기본 간격과 같다 */
const HINT_OFFSET = 9;

type PopoverContentProps = Extract<
  ComponentProps<typeof Popover.Content>,
  { presentation?: 'popover' }
>;

export interface HintPopoverContentProps extends Omit<
  PopoverContentProps,
  'presentation' | 'children' | 'title'
> {
  icon?: typeof MicIcon;
  title?: string;
  description?: string;
  /** 바깥을 막지 않는다. 안내가 떠 있어도 대상과 화면을 그대로 눌러야 할 때 쓴다. 닫기는 X와 대상이다 */
  isPassThrough?: boolean;
  /** 설명 아래에 더 보일 내용 */
  children?: ReactNode;
}

interface HintPlacementInput {
  placement: NonNullable<PopoverContentProps['placement']>;
  trigger: { pageY: number; height: number } | null | undefined;
  contentHeight: number | null | undefined;
  windowHeight: number;
  topInset: number;
  bottomInset: number;
  offset: number;
}

/**
 * 말풍선이 상태바나 홈 표시줄과 겹치면 반대쪽으로 뒤집는다. 양쪽 다 모자라면 자리가 더 많은 쪽이다.
 * 잴 수 있기 전과 옆으로 뜨는 말풍선은 요청한 방향 그대로다.
 */
export function getHintPlacement({
  placement,
  trigger,
  contentHeight,
  windowHeight,
  topInset,
  bottomInset,
  offset,
}: HintPlacementInput): HintPlacementInput['placement'] {
  if (trigger == null || contentHeight == null || (placement !== 'top' && placement !== 'bottom')) {
    return placement;
  }
  const needed = offset + contentHeight;
  const roomAbove = trigger.pageY - topInset - HINT_SCREEN_INSET;
  const roomBelow = windowHeight - bottomInset - HINT_SCREEN_INSET - trigger.pageY - trigger.height;
  const room = placement === 'top' ? roomAbove : roomBelow;
  const oppositeRoom = placement === 'top' ? roomBelow : roomAbove;
  if (room >= needed || room >= oppositeRoom) {
    return placement;
  }
  return placement === 'top' ? 'bottom' : 'top';
}

/**
 * 앱의 모든 안내 말풍선 모양. `Popover` 안에 `Popover.Trigger`와 나란히 둔다.
 * 아이콘·제목·작은 X가 한 줄이고 그 아래에 설명이 온다. 안전 영역과 겹치면 반대쪽으로 뒤집는다.
 */
export function HintPopoverContent({
  icon: Icon,
  title,
  description,
  isPassThrough = false,
  placement = 'top',
  align = 'end',
  avoidCollisions = false,
  offset = HINT_OFFSET,
  width,
  className,
  children,
  ...contentProps
}: HintPopoverContentProps) {
  const { t } = useTranslation('common');
  const fontScaledSize = useFontScaledSize();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const { triggerPosition, contentLayout } = usePopover();

  const resolvedPlacement = getHintPlacement({
    placement,
    trigger: triggerPosition,
    contentHeight: contentLayout?.height,
    windowHeight,
    topInset,
    bottomInset,
    offset,
  });
  const closeSize = fontScaledSize(20);
  const descriptionText = description != null && (
    <Text
      size="b4"
      shade={6}
      lineBreakStrategyIOS="hangul-word"
      className={title == null ? 'flex-1' : undefined}
    >
      {description}
    </Text>
  );
  const closeButton = (
    <Popover.Close
      variant="ghost"
      hitSlop={14}
      style={{ width: closeSize, height: closeSize }}
      accessibilityLabel={t('actions.close')}
      testID="hint-popover-close"
    >
      <CloseIcon
        width={fontScaledSize(16)}
        height={fontScaledSize(16)}
        colorClassName="text-gray-6"
      />
    </Popover.Close>
  );

  return (
    <Popover.Portal disableFullWindowOverlay={false}>
      {!isPassThrough && <Popover.Overlay testID="hint-popover-overlay" />}
      <Popover.Content
        presentation="popover"
        placement={resolvedPlacement}
        align={align}
        avoidCollisions={avoidCollisions}
        offset={offset}
        width={width ?? Math.min(windowWidth - HINT_SCREEN_INSET * 2, HINT_MAX_WIDTH)}
        className={className ?? 'rounded-2xl border border-border px-4 py-3'}
        testID="hint-popover"
        {...contentProps}
      >
        <Popover.Arrow />
        <VStack gap={4}>
          {title == null ? (
            <HStack gap={8} align="start">
              {descriptionText}
              {closeButton}
            </HStack>
          ) : (
            <>
              <HStack gap={4} align="start">
                {Icon != null && (
                  <Icon
                    width={fontScaledSize(18)}
                    height={fontScaledSize(18)}
                    colorClassName="text-main"
                  />
                )}
                <Text
                  size="b3"
                  weight="semibold"
                  className="flex-1"
                  lineBreakStrategyIOS="hangul-word"
                >
                  {title}
                </Text>
                {closeButton}
              </HStack>
              {descriptionText}
            </>
          )}
          {children}
        </VStack>
      </Popover.Content>
    </Popover.Portal>
  );
}
