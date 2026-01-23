import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { Avatar } from 'heroui-native';
import type { ReactNode } from 'react';
import type { FriendRequestUser } from '../../models/friend-request.model';

interface FriendRequestRowProps {
  user: FriendRequestUser;
  actions: ReactNode;
}

export const FriendRequestRow = ({ user, actions }: FriendRequestRowProps) => {
  const displayName = user.name ?? user.userTag;

  return (
    <ListRow
      horizontalPadding="none"
      left={
        <Avatar alt={displayName} className="size-10">
          {user.profileImage && <Avatar.Image source={{ uri: user.profileImage }} />}
          <Avatar.Fallback>
            <Avatar.Image source={require('@assets/images/icon.png')} />
          </Avatar.Fallback>
        </Avatar>
      }
      contents={<ListRow.Texts type="1RowTypeA" top={displayName} />}
      right={actions}
    />
  );
};
