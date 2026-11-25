import Block from '@expo/material-symbols/block.xml';
import Flag from '@expo/material-symbols/flag.xml';
import MoreHoriz from '@expo/material-symbols/more_horiz.xml';

import { nativeIcon } from './native-icon';

export const STACK_MORE_ICON = nativeIcon({ ios: 'ellipsis', android: MoreHoriz });

/** 네이티브 ⋯ 메뉴 항목 아이콘. 색은 시스템이 정한다 */
export const STACK_MENU_ICON = {
  report: nativeIcon({ ios: 'flag', android: Flag }),
  block: nativeIcon({ ios: 'nosign', android: Block }),
} as const;
