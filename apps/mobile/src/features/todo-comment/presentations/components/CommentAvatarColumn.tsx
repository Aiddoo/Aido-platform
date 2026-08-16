import { VStack } from '@src/shared/ui';

import type { TodoCommentAuthor } from '../../models/todo-comment.model';
import { CommentAuthorAvatar } from './CommentAuthorAvatar';
import { THREAD_COLUMN_WIDTH } from './ThreadLine';

interface CommentAvatarColumnProps {
  author: TodoCommentAuthor | null;
}

/**
 * 댓글 왼쪽 열. 스레드 선은 이 열 뒤를 지나가고, 불투명한 아바타가 지나가는 자리를 가린다.
 * 선을 이 안에서 그리지 않아, 행 여백 때문에 선이 끊길 일이 없다.
 */
export function CommentAvatarColumn({ author }: CommentAvatarColumnProps) {
  return (
    <VStack className={THREAD_COLUMN_WIDTH}>
      <CommentAuthorAvatar author={author} size="md" />
    </VStack>
  );
}
