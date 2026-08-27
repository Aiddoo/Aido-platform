import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useTranslation } from '@src/shared/i18n';
import { Avatar } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

import type { TodoCommentAuthor } from '../../models/todo-comment.model';

export type TodoCommentAuthorAvatarSize = 'xs' | 'sm' | 'md';

export const TODO_COMMENT_AUTHOR_AVATAR_SIZE: Record<TodoCommentAuthorAvatarSize, number> = {
  xs: 20,
  sm: 28,
  md: 36,
};

const AVATAR_SIZE: Record<TodoCommentAuthorAvatarSize, string> = {
  xs: 'size-5',
  sm: 'size-7',
  md: 'size-9',
};

interface TodoCommentAuthorAvatarProps extends Omit<
  ComponentProps<typeof Avatar>,
  'alt' | 'children' | 'size'
> {
  author: TodoCommentAuthor | null;
  size: TodoCommentAuthorAvatarSize;
}

export function TodoCommentAuthorAvatar({
  author,
  size,
  className,
  ...avatarProps
}: TodoCommentAuthorAvatarProps) {
  const { t } = useTranslation('todoComment');

  return (
    <Avatar
      {...avatarProps}
      alt={author?.name ?? t('list.unknownUser')}
      className={cn(AVATAR_SIZE[size], className)}
    >
      <Avatar.Image source={getProfileIconSource(author?.profileImage ?? null)} />
    </Avatar>
  );
}
