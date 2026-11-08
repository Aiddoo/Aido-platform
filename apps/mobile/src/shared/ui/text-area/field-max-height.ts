import { createContext } from 'react';

/** 키보드 시트가 칸 높이를 받아 칸 전체가 넘지 않을 높이를 돌려준다. 자라는 칸이 아래 버튼 줄을 키보드 뒤로 밀지 않게 한다. 키보드가 없으면 null */
export const FieldMaxHeightContext = createContext<((fieldHeight: number) => number | null) | null>(
  null,
);
