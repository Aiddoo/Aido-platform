import MoreHoriz from '@expo/material-symbols/more_horiz.xml';

/** 헤더 ⋯(더 보기) 메뉴 아이콘. iOS는 SF Symbol, Android는 Material Symbol을 쓴다. */
export const STACK_MORE_ICON = process.env.EXPO_OS === 'ios' ? 'ellipsis' : MoreHoriz;
