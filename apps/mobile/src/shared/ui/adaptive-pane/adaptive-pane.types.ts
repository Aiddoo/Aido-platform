import type { ReactNode } from 'react';

export interface AdaptivePaneProps {
  /** 목록 영역. compact에서는 이것만 렌더링한다. */
  primary: ReactNode;
  /** 상세 영역. medium 이상에서만 렌더링한다. */
  secondary: ReactNode;
}
