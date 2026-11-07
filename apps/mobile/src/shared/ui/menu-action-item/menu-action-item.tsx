import { Menu } from 'heroui-native';
import type { ComponentProps, ComponentType } from 'react';

import { Text } from '../text/text';
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
        <Menu.ItemTitle>
          <Text size="b2" weight="medium">
            {title}
          </Text>
        </Menu.ItemTitle>
      ) : (
        <VStack flex={1}>
          <Menu.ItemTitle>
            <Text size="b2" weight="medium">
              {title}
            </Text>
          </Menu.ItemTitle>
          <Menu.ItemDescription>
            <Text size="b4">{description}</Text>
          </Menu.ItemDescription>
        </VStack>
      )}
    </Menu.Item>
  );
}
