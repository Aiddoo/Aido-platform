import { createContext, type ReactNode, use } from 'react';

/** footer 내용이 바뀔 때 gorhom의 footerComponent가 바뀌면 고정 영역이 다시 마운트되어 누르던 버튼을 놓친다 */
export const SheetFooterContext = createContext<ReactNode>(null);

export function SheetFooterSlot() {
  return use(SheetFooterContext);
}
