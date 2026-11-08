import { SettingsListGroup, type StyledIcon } from '@src/shared/ui';
import type { ComponentProps } from 'react';

import {
  type MyPageMenuPathname,
  useMyPageMenuNavigation,
} from '../hooks/use-my-page-menu-navigation';

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
      icon={<SettingsListGroup.Icon Icon={Icon} />}
      isSelected={isSelected(pathname)}
      onPress={() => navigate(pathname)}
    />
  );
}
