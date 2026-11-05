import Block from '@expo/material-symbols/block.xml';
import Flag from '@expo/material-symbols/flag.xml';
import MoreHoriz from '@expo/material-symbols/more_horiz.xml';
import { Platform } from 'react-native';

/** 헤더 ⋯(더 보기) 메뉴 아이콘. iOS는 SF Symbol, Android는 Material Symbol을 쓴다. */
export const STACK_MORE_ICON = Platform.OS === 'ios' ? 'ellipsis' : MoreHoriz;

/** 네이티브 ⋯ 메뉴 항목 아이콘. 색은 시스템이 정한다 */
export const STACK_MENU_ICON = {
  report: Platform.OS === 'ios' ? 'flag' : Flag,
  block: Platform.OS === 'ios' ? 'nosign' : Block,
} as const;
