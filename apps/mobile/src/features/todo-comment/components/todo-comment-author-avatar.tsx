import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useTranslation } from '@src/shared/i18n';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

import type { TodoCommentAuthor } from '../domains/todo-comment.model';

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
  ComponentProps<typeof UserAvatar>,
  'alt' | 'profileImage' | 'size'
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
    <UserAvatar
      {...avatarProps}
      alt={author?.name ?? t('list.unknownUser')}
      className={cn(AVATAR_SIZE[size], className)}
      profileImage={author?.profileImage ?? null}
    />
  );
}
