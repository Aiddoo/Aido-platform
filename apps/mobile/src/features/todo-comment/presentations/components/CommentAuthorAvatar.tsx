import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useTranslation } from '@src/shared/i18n';
import { Avatar } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';

import type { TodoCommentAuthor } from '../../models/todo-comment.model';

/** 아바타는 글자 크기와 무관하게 고정이다 — 스레드 선의 자리가 흔들리지 않게. */
export type CommentAuthorAvatarSize = 'xs' | 'sm' | 'md';

const AVATAR_SIZE: Record<CommentAuthorAvatarSize, string> = {
  /** 작성 시트의 '답글 또 달기' 줄 */
  xs: 'size-5',
  /** 미리보기 답글 */
  sm: 'size-7',
  /** 목록의 댓글 */
  md: 'size-9',
};

interface CommentAuthorAvatarProps {
  /** 삭제된 댓글은 작성자가 지워져 null로 내려온다. */
  author: TodoCommentAuthor | null;
  size: CommentAuthorAvatarSize;
}

export function CommentAuthorAvatar({ author, size }: CommentAuthorAvatarProps) {
  const { t } = useTranslation('todoComment');

  return (
    <Avatar alt={author?.name ?? t('list.unknownUser')} className={cn(AVATAR_SIZE[size])}>
      <Avatar.Image source={getProfileIconSource(author?.profileImage ?? null)} />
    </Avatar>
  );
}
