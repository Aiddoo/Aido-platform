import { createContext } from 'react';

/** 화면 폼은 포커스한 칸을 키보드 위 버튼보다 위에 두므로, 키보드에 붙는 버튼이 키보드가 열렸을 때의 제 높이를 알린다 */
export const KeyboardFooterHeightContext = createContext<((height: number) => void) | null>(null);
