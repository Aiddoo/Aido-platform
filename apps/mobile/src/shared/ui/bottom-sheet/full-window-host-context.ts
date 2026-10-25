import { createContext } from 'react';

/**
 * 시트가 내비게이터(탭 레일 포함) 위 전체 창에 그려지는 호스트 안인지. route 시트와 overlay가 true를 준다.
 * 이 호스트의 시트는 iPhone Duo 레일을 덮으므로 가로 safe area 대신 reserved region만 피한다.
 */
export const FullWindowHostContext = createContext(false);
