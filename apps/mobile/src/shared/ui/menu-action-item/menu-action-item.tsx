import { Menu } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { StyledIcon } from '../icon/create-styled-icon';
import { Text } from '../text/text';
import { VStack } from '../v-stack/v-stack';

const MENU_ICON_SIZE = 18;

type MenuActionItemProps = Omit<ComponentProps<typeof Menu.Item>, 'children'> & {
  Icon: StyledIcon;
  title: string;
  description?: string | null;
};

export function MenuActionItem({
  Icon,
  title,
  description,
  variant,
  ...itemProps
}: MenuActionItemProps) {
  const isDanger = variant === 'danger';
  const titleElement = (
    <Menu.ItemTitle>
      <Text
        size="b2"
        weight="medium"
        // oxlint-disable-next-line aido/no-classname-concat -- 1.15.2 전환 #1400
        className={isDanger ? 'text-danger' : 'text-foreground'}
      >
        {title}
      </Text>
    </Menu.ItemTitle>
  );

  return (
    <Menu.Item variant={variant} {...itemProps}>
      <Icon
        width={MENU_ICON_SIZE}
        height={MENU_ICON_SIZE}
        // oxlint-disable-next-line aido/no-classname-concat -- 1.15.2 전환 #1400
        colorClassName={isDanger ? 'text-danger' : 'text-main'}
      />
      {description == null ? (
        titleElement
      ) : (
        <VStack flex={1}>
          {titleElement}
          <Menu.ItemDescription>
            <Text size="b4" className="text-muted">
              {description}
            </Text>
          </Menu.ItemDescription>
        </VStack>
      )}
    </Menu.Item>
  );
}
