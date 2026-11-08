import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { useTranslation } from '@src/shared/i18n';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

import type { TodoCommentAuthor } from '../domains/todo-comment.model';

type TodoCommentAuthorAvatarSize = 'xs' | 'sm' | 'md';

const AVATAR_SIZE = {
  xs: { px: 20, className: 'size-5' },
  sm: { px: 28, className: 'size-7' },
  md: { px: 36, className: 'size-9' },
} as const satisfies Record<TodoCommentAuthorAvatarSize, { px: number; className: string }>;

export const TODO_COMMENT_AUTHOR_AVATAR_SIZE = {
  xs: AVATAR_SIZE.xs.px,
  sm: AVATAR_SIZE.sm.px,
  md: AVATAR_SIZE.md.px,
} as const;

interface TodoCommentAuthorAvatarProps extends Omit<
  ComponentProps<typeof UserAvatar>,
  'alt' | 'profileImage' | 'size'
> {
  author: Pick<TodoCommentAuthor, 'name' | 'profileImage'> | null;
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
      className={cn(AVATAR_SIZE[size].className, className)}
      profileImage={author?.profileImage ?? null}
    />
  );
}
