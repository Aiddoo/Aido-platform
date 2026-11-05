import Close from '@expo/material-symbols/close.xml';
import { Platform } from 'react-native';

/** 헤더 닫기 아이콘. iOS는 SF Symbol, Android는 Material Symbol을 쓴다. */
export const STACK_CLOSE_ICON = Platform.OS === 'ios' ? 'xmark' : Close;
