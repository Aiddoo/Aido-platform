import { SettingsListGroup, type StyledIcon } from '@src/shared/ui';
import type { ComponentProps } from 'react';

import {
  type MyPageMenuPathname,
  useIsMyPageMenuItemSelected,
  useMyPageMenuNavigate,
} from '../hooks/use-my-page-menu-navigation';

type MyPageMenuItemProps = Omit<
  ComponentProps<typeof SettingsListGroup.Item>,
  'className' | 'icon' | 'isSelected'
> & {
  pathname: MyPageMenuPathname;
  Icon: StyledIcon;
};

export function MyPageMenuItem({ pathname, Icon, onPress, ...props }: MyPageMenuItemProps) {
  const navigate = useMyPageMenuNavigate();
  const isSelected = useIsMyPageMenuItemSelected(pathname);

  return (
    <SettingsListGroup.Item
      {...props}
      icon={<SettingsListGroup.Icon Icon={Icon} />}
      isSelected={isSelected}
      onPress={(event) => {
        navigate(pathname);
        // asChild 트리거·코치마크가 자식에 넣은 onPress를 이어 불러 그 누름이 사라지지 않게 한다
        onPress?.(event);
      }}
    />
  );
}
