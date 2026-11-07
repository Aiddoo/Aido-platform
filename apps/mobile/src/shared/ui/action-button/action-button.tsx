import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import type { PressableProps } from 'react-native';

import type { StyledIcon } from '../icon/create-styled-icon';
import { Text } from '../text';

const ICON_SIZE = 16;
const ICON_FONT_SCALE_RATIO = 0.3;

interface ActionButtonProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'onPress'
> {
  icon: ReactNode;
  label: string;
  isActive?: boolean;
  onPress?: PressableProps['onPress'];
}

export function ActionButton({
  icon,
  label,
  isActive = false,
  className,
  ...props
}: ActionButtonProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full border px-3',
        isActive ? 'border-main/30 bg-main/10' : 'border-gray-3',
        className,
      )}
      {...props}
    >
      {icon}
      <Text
        size="e1"
        weight="medium"
        {...(isActive ? { tone: 'brand' as const } : { shade: 6 as const })}
      >
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
  as: IconComponent,
  colorClassName,
}: {
  as: StyledIcon;
  colorClassName: string;
}) {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(ICON_SIZE, ICON_FONT_SCALE_RATIO);

  return <IconComponent width={size} height={size} colorClassName={colorClassName} />;
};

export type { ActionButtonProps };
