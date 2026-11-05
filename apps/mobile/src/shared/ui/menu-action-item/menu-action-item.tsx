import { Menu } from 'heroui-native';
import type { ComponentProps, ComponentType } from 'react';

import { VStack } from '../v-stack/v-stack';

const MENU_ICON_SIZE = 18;

type MenuActionItemProps = Omit<ComponentProps<typeof Menu.Item>, 'children'> & {
  icon: ComponentType<{ width: number; height: number; colorClassName: string }>;
  title: string;
  description?: string | null;
};

/** 앱의 ⋯ 메뉴 항목. 앞에 주황 아이콘을 두고, 삭제·차단 같은 위험한 항목은 빨간색으로 그린다 */
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
