import { Box } from '@src/shared/ui';
import type { PropsWithChildren } from 'react';

import { useFeedTodoDetailHandoff } from '../hooks/use-feed-selected-todo';

/** 피드 목록 pane. 접힌 화면으로 바뀌면 선택된 할 일과 댓글 위치를 상세 화면으로 넘긴다. */
export function FeedListPane({ children }: PropsWithChildren) {
  useFeedTodoDetailHandoff();

  return (
    <Box flex={1} className="bg-white">
      {children}
    </Box>
  );
}
