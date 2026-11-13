import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { cn } from '@src/shared/utils/cn';
import { Popover, usePopover } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { match } from 'ts-pattern';

import { Box } from '../box/box';
import { HStack } from '../h-stack/h-stack';
import { type StyledIcon } from '../icon/create-styled-icon';
import { CloseIcon } from '../icon/icons';
import { VStack } from '../v-stack/v-stack';
import { WordWrapText } from '../word-wrap-text/word-wrap-text';

const HINT_MAX_WIDTH = 300;
const HINT_SCREEN_INSET = 12;
const CLOSE_BUTTON_SIZE = 20;
const CLOSE_ICON_SIZE = 16;
/** 닫기 버튼은 작게 그리고 손가락 닿는 자리를 넓힌다 */
const CLOSE_HIT_SLOP = 14;
const TITLE_ICON_SIZE = 18;
/** `Popover.Content`의 기본 간격과 같다 */
export const HINT_OFFSET = 9;
// 지나가게 둔 말풍선은 닫기만 누름을 받는다. 홈 표시줄 위로 밀려 위 줄 칩을 덮어도 칩이 눌리고 스크린리더도 가두지 않는다.
// 테마 배경 층은 이 테마에서 빈 뷰지만 말풍선 전체를 덮어 누름을 먹으므로 뺀다
const PASS_THROUGH_CONTENT_PROPS = {
  pointerEvents: 'box-none',
  background: null,
  'aria-modal': false,
} as const;

type PopoverContentProps = Extract<
  ComponentProps<typeof Popover.Content>,
  { presentation?: 'popover' }
>;

export interface HintPopoverContentProps extends Omit<
  PopoverContentProps,
  'presentation' | 'children' | 'title'
> {
  Icon?: StyledIcon;
  title?: string;
  description?: string;
  isPassThrough?: boolean;
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

function getHintPlacement({
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

interface HintWidthInput {
  placement: NonNullable<PopoverContentProps['placement']>;
  trigger: { pageX: number; width: number } | null | undefined;
  windowWidth: number;
  leftInset: number;
  rightInset: number;
  offset: number;
}

/** 세로 레일·가로 화면에서도 좌우 안전 영역 안에 들어가는 폭 */
function getHintWidth({
  placement,
  trigger,
  windowWidth,
  leftInset,
  rightInset,
  offset,
}: HintWidthInput): number {
  const widest = Math.min(
    windowWidth - leftInset - rightInset - HINT_SCREEN_INSET * 2,
    HINT_MAX_WIDTH,
  );
  if (trigger == null) {
    return widest;
  }
  return match(placement)
    .with('left', () => Math.min(trigger.pageX - offset - HINT_SCREEN_INSET - leftInset, widest))
    .with('right', () =>
      Math.min(
        windowWidth - rightInset - HINT_SCREEN_INSET - (trigger.pageX + trigger.width + offset),
        widest,
      ),
    )
    .otherwise(() => widest);
}

export function HintPopoverContent({
  Icon,
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
  const {
    top: topInset,
    bottom: bottomInset,
    left: leftInset,
    right: rightInset,
  } = useSafeAreaInsets();
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
  const textPointerEvents = isPassThrough ? 'none' : 'auto';
  // 좁은 폰은 말풍선 폭이 좁아 Android에서도 단어 단위로 꺾는다
  const descriptionText = description != null && (
    <Box pointerEvents={textPointerEvents} className={cn(title == null && 'flex-1')}>
      <WordWrapText size="b4" shade={6}>
        {description}
      </WordWrapText>
    </Box>
  );
  const closeButton = (
    <Popover.Close
      variant="ghost"
      hitSlop={CLOSE_HIT_SLOP}
      style={{ width: CLOSE_BUTTON_SIZE, height: CLOSE_BUTTON_SIZE }}
      accessibilityLabel={t('actions.close')}
      testID="hint-popover-close"
    >
      <CloseIcon
        width={fontScaledSize(CLOSE_ICON_SIZE)}
        height={fontScaledSize(CLOSE_ICON_SIZE)}
        colorClassName="text-gray-6"
      />
    </Popover.Close>
  );

  return (
    <Popover.Portal disableFullWindowOverlay={false}>
      {/* Android 제스처 핸들러는 배경 없는 뷰를 그대로 통과해 아래 시트 배경의 탭까지 시트를 닫는다. 보이지 않는 배경을 둔다 */}
      {!isPassThrough && <Popover.Overlay className="bg-black/1" testID="hint-popover-overlay" />}
      <Popover.Content
        presentation="popover"
        placement={resolvedPlacement}
        align={align}
        avoidCollisions={avoidCollisions}
        offset={offset}
        width={
          width ??
          getHintWidth({
            placement: resolvedPlacement,
            trigger: triggerPosition,
            windowWidth,
            leftInset,
            rightInset,
            offset,
          })
        }
        className={cn('rounded-2xl border border-border px-4 py-3', className)}
        testID="hint-popover"
        {...(isPassThrough && PASS_THROUGH_CONTENT_PROPS)}
        {...contentProps}
      >
        <Popover.Arrow />
        <VStack gap={4} pointerEvents="box-none">
          {title == null ? (
            <HStack gap={8} align="start" pointerEvents="box-none">
              {descriptionText}
              {closeButton}
            </HStack>
          ) : (
            <>
              <HStack gap={4} align="start" pointerEvents="box-none">
                <HStack gap={4} align="start" pointerEvents={textPointerEvents} className="flex-1">
                  {Icon != null && (
                    <Icon
                      width={fontScaledSize(TITLE_ICON_SIZE)}
                      height={fontScaledSize(TITLE_ICON_SIZE)}
                      colorClassName="text-main"
                    />
                  )}
                  <WordWrapText size="b3" weight="semibold" className="flex-1">
                    {title}
                  </WordWrapText>
                </HStack>
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
