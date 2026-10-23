import type { ReactNode } from 'react';

export interface AdaptivePaneProps {
  /** 항상 렌더링하는 목록 영역. */
  primary: ReactNode;
  /** medium 이상에서만 렌더링하는 상세 영역. compact에서는 라우트 push가 상세를 대신한다. */
  secondary: ReactNode;
}
