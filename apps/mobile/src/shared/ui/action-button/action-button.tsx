import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

import type { StyledIcon } from '../icon/create-styled-icon';
import { Text } from '../text/text';

const ICON_SIZE = 16;
const ICON_FONT_SCALE_RATIO = 0.3;

/** 칩 높이 32pt를 44pt에 가깝게 맞추도록 모양은 두고 눌리는 범위만 위아래로 넓힌다 */
const HIT_SLOP = { top: 6, bottom: 6 };

interface ActionButtonProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  icon: ReactNode;
  label: string;
  isActive?: boolean;
}

export function ActionButton({
  icon,
  label,
  isActive = false,
  hitSlop = HIT_SLOP,
  className,
  ...props
}: ActionButtonProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlop}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full border px-3',
        isActive ? 'border-main/30 bg-main/10' : 'border-gray-3',
        className,
      )}
      {...props}
    >
      {icon}
      <Text size="e1" weight="medium" tone={isActive ? 'brand' : 'neutral'} shade={6}>
        {label}
      </Text>
    </PressableFeedback>
  );
}

/** 칩과 같은 높이로 자리를 잡아 카테고리를 읽은 뒤 칩 줄이 밀리지 않게 한다 */
ActionButton.Loading = function Loading({ className }: { className?: string }) {
  return <Skeleton className={cn('h-8 w-24 rounded-full', className)} />;
};

ActionButton.Icon = function Icon({
  Icon: IconComponent,
  colorClassName,
}: {
  Icon: StyledIcon;
  colorClassName: string;
}) {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(ICON_SIZE, ICON_FONT_SCALE_RATIO);

  return <IconComponent width={size} height={size} colorClassName={colorClassName} />;
};

export type { ActionButtonProps };
