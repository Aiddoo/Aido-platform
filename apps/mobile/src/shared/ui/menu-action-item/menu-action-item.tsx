import { Menu } from 'heroui-native';
import type { ComponentProps, ComponentType } from 'react';

import { VStack } from '../v-stack/v-stack';

const MENU_ICON_SIZE = 18;

type MenuActionItemProps = Omit<ComponentProps<typeof Menu.Item>, 'children'> & {
  icon: ComponentType<{ width: number; height: number; colorClassName: string }>;
  title: string;
  description?: string | null;
};

export function MenuActionItem({
  icon: Icon,
  title,
  description,
  variant,
  ...itemProps
}: MenuActionItemProps) {
  return (
    <Menu.Item variant={variant} {...itemProps}>
      <Icon
        width={MENU_ICON_SIZE}
        height={MENU_ICON_SIZE}
        colorClassName={variant === 'danger' ? 'text-error' : 'text-main'}
      />
      {description == null ? (
        <Menu.ItemTitle>{title}</Menu.ItemTitle>
      ) : (
        <VStack flex={1}>
          <Menu.ItemTitle>{title}</Menu.ItemTitle>
          <Menu.ItemDescription>{description}</Menu.ItemDescription>
        </VStack>
      )}
    </Menu.Item>
  );
}
