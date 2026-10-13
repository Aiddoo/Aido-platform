import { Avatar } from '@src/shared/ui';
import type { ComponentProps } from 'react';

import { getProfileIconSource } from '../utils/profile-icon.util';

interface UserAvatarProps extends Omit<ComponentProps<typeof Avatar>, 'children'> {
  profileImage: string | null;
}

export function UserAvatar({ profileImage, ...props }: UserAvatarProps) {
  return (
    <Avatar {...props}>
      <Avatar.Image source={getProfileIconSource(profileImage)} />
    </Avatar>
  );
}
