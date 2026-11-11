import { ArrowRightIcon, Box, ListRow } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

interface TodoActionRowProps extends Pick<
  ComponentProps<typeof PressableFeedback>,
  'onPress' | 'isDisabled' | 'testID'
> {
  icon: ReactNode;
  label: string;
  isDanger?: boolean;
  hasArrow?: boolean;
}

export function TodoActionRow({
  icon,
  label,
  isDanger = false,
  hasArrow = false,
  ...pressableProps
}: TodoActionRowProps) {
  return (
    <PressableFeedback accessibilityRole="button" {...pressableProps}>
      <ListRow
        horizontalPadding="medium"
        verticalPadding="medium"
        left={
          <Box
            className={cn(
              'size-7 items-center justify-center rounded-full',
              isDanger ? 'bg-error/10 dark:bg-error/20' : 'bg-main/10',
            )}
          >
            {icon}
          </Box>
        }
        contents={
          <ListRow.Texts
            type="1RowTypeA"
            top={label}
            topProps={isDanger ? { size: 'b2', tone: 'danger' } : { size: 'b2' }}
          />
        }
        right={
          hasArrow ? (
            <ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />
          ) : undefined
        }
      />
    </PressableFeedback>
  );
}
