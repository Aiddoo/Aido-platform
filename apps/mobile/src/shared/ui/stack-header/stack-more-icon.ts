import Block from '@expo/material-symbols/block.xml';
import Flag from '@expo/material-symbols/flag.xml';
import MoreHoriz from '@expo/material-symbols/more_horiz.xml';

export const STACK_MORE_ICON = process.env.EXPO_OS === 'ios' ? 'ellipsis' : MoreHoriz;

/** 네이티브 ⋯ 메뉴 항목 아이콘. 색은 시스템이 정한다 */
export const STACK_MENU_ICON = {
  report: process.env.EXPO_OS === 'ios' ? 'flag' : Flag,
  block: process.env.EXPO_OS === 'ios' ? 'nosign' : Block,
} as const;
