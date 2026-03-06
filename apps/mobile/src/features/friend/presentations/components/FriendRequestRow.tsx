import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { ListRow } from '@src/shared/ui';
import { Avatar } from 'heroui-native';
import type { ReactNode } from 'react';
import type { FriendRequest } from '../../models/friend.model';

interface FriendRequestRowProps {
  user: FriendRequest;
  actions: ReactNode;
}

export const FriendRequestRow = ({ user, actions }: FriendRequestRowProps) => {
  const displayName = user.name ?? user.userTag;

  return (
    <ListRow
      horizontalPadding="none"
      left={
        <Avatar alt={displayName} className="size-10">
          <Avatar.Image source={getProfileIconSource(user.profileImage)} />
        </Avatar>
      }
      contents={<ListRow.Texts type="1RowTypeA" top={displayName} />}
      right={actions}
    />
  );
};
