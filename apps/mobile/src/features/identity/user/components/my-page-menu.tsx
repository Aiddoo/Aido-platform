import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { SettingsListGroup, type StyledIcon } from '@src/shared/ui';
import type { ComponentProps } from 'react';

import {
  type MyPageMenuPathname,
  useMyPageMenuNavigation,
} from '../hooks/use-my-page-menu-navigation';

const MENU_ICON_SIZE = 20;

type MyPageMenuItemProps = Omit<
  ComponentProps<typeof SettingsListGroup.Item>,
  'onPress' | 'className' | 'icon' | 'isSelected'
> & {
  pathname: MyPageMenuPathname;
  Icon: StyledIcon;
};

export function MyPageMenuItem({ pathname, Icon, ...props }: MyPageMenuItemProps) {
  const { navigate, isSelected } = useMyPageMenuNavigation();

  return (
    <SettingsListGroup.Item
      {...props}
      icon={<MyPageMenuIcon Icon={Icon} />}
      isSelected={isSelected(pathname)}
      onPress={() => navigate(pathname)}
    />
  );
}

function MyPageMenuIcon({ Icon }: { Icon: StyledIcon }) {
  const fontScaledSize = useFontScaledSize();

  return (
    <Icon
      width={fontScaledSize(MENU_ICON_SIZE)}
      height={fontScaledSize(MENU_ICON_SIZE)}
      colorClassName="text-main"
    />
  );
}
