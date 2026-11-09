import { type ComponentRef, createContext, type RefObject, use } from 'react';
import type { View } from 'react-native';

export type FocusedFieldNode = ComponentRef<typeof View>;

/** 키보드 시트·화면 폼은 포커스한 입력을 라벨·테두리·오류 문구까지 한 칸으로 재야 footer·키보드 버튼에 가리지 않으므로, 입력이 칸 전체 뷰를 알린다 */
export const FocusedFieldContext = createContext<
  ((node: FocusedFieldNode, isFocused: boolean) => void) | null
>(null);

export function useReportFocusedField(fieldRef: RefObject<FocusedFieldNode | null>) {
  const report = use(FocusedFieldContext);

  return (isFocused: boolean) => {
    if (fieldRef.current != null) {
      report?.(fieldRef.current, isFocused);
    }
  };
}
