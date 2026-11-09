import { SettingsListGroup, type StyledIcon } from '@src/shared/ui';
import type { ComponentProps } from 'react';

import {
  type MyPageMenuPathname,
  useIsMyPageMenuItemSelected,
  useMyPageMenuNavigate,
} from '../hooks/use-my-page-menu-navigation';

type MyPageMenuItemProps = Omit<
  ComponentProps<typeof SettingsListGroup.Item>,
  'onPress' | 'className' | 'icon' | 'isSelected'
> & {
  pathname: MyPageMenuPathname;
  Icon: StyledIcon;
};

export function MyPageMenuItem({ pathname, Icon, ...props }: MyPageMenuItemProps) {
  const navigate = useMyPageMenuNavigate();
  const isSelected = useIsMyPageMenuItemSelected(pathname);

  return (
    <SettingsListGroup.Item
      {...props}
      icon={<SettingsListGroup.Icon Icon={Icon} />}
      isSelected={isSelected}
      onPress={() => navigate(pathname)}
    />
  );
}
