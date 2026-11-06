import Close from '@expo/material-symbols/close.xml';
import { Platform } from 'react-native';

export const STACK_CLOSE_ICON = Platform.OS === 'ios' ? 'xmark' : Close;
