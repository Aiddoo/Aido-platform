import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';

import { ArrowRightIcon } from '../icon';
import { ListRow } from '../list-row';
import { Text } from '../text';
import { VStack } from '../v-stack';

interface SettingNavigationProps extends PropsWithChildren {
  label?: string;
}

export function SettingNavigation({ label, children }: SettingNavigationProps) {
  return (
    <VStack p={8} gap={8} className="bg-white rounded-2xl">
      {label && (
        <Text size="b2" weight="semibold" className="px-4 pt-2" shade={9}>
          {label}
        </Text>
      )}
      {children}
    </VStack>
  );
}

interface SettingNavigationItemProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children'
> {
  label: string;
  right?: ReactNode;
}

SettingNavigation.Item = function Item({
  label,
  right,
  isDisabled,
  className,
  ...props
}: SettingNavigationItemProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      isDisabled={isDisabled}
      className={cn('rounded-lg', className)}
      {...props}
    >
      <PressableFeedback.Highlight className="rounded-xl" />
      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top={label} topProps={{ shade: 8 }} />}
        right={right ?? <ArrowRightIcon colorClassName="text-gray-6" />}
        horizontalPadding="medium"
        isDisabled={isDisabled}
        className="min-h-11"
      />
    </PressableFeedback>
  );
};
