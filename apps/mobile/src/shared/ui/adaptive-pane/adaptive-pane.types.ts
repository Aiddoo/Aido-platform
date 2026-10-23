import type { ReactNode } from 'react';

export interface AdaptivePaneProps {
  /** 목록 영역. `compactPane`이 `primary`(기본)면 compact에서도 렌더링한다. */
  primary: ReactNode;
  /** 상세 영역. medium 이상에서 항상, compact에서는 `compactPane`이 `secondary`일 때만 렌더링한다. */
  secondary: ReactNode;
  /** compact에서 남길 영역. 설정처럼 상세 쪽이 내비게이터인 화면은 `secondary`를 쓴다. */
  compactPane?: 'primary' | 'secondary';
}
