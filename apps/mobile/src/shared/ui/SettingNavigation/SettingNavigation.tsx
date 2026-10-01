import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';

import { ArrowRightIcon } from '../Icon';
import { ListRow } from '../ListRow';
import { Text } from '../Text';
import { VStack } from '../VStack';

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
  'children' | 'isDisabled'
> {
  label: string;
  right?: ReactNode;
  disabled?: boolean;
}

SettingNavigation.Item = function Item({
  label,
  right,
  disabled,
  className,
  ...props
}: SettingNavigationItemProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      isDisabled={disabled}
      className={['rounded-lg', className].filter(Boolean).join(' ')}
      {...props}
    >
      <PressableFeedback.Highlight className="rounded-xl" />
      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top={label} topProps={{ shade: 8 }} />}
        right={right ?? <ArrowRightIcon colorClassName="text-gray-6" />}
        horizontalPadding="medium"
        disabled={disabled}
        className="min-h-11"
      />
    </PressableFeedback>
  );
};
