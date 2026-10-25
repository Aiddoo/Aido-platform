import ArrowBack from '@expo/material-symbols/arrow_back.xml';

/** 헤더 뒤로가기 아이콘. iOS는 SF Symbol, Android는 Material Symbol을 쓴다. */
export const STACK_BACK_ICON = process.env.EXPO_OS === 'ios' ? 'chevron.backward' : ArrowBack;
