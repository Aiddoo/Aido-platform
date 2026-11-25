import Check from '@expo/material-symbols/check.xml';
import CheckBox from '@expo/material-symbols/check_box.xml';
import Delete from '@expo/material-symbols/delete.xml';
import Keep from '@expo/material-symbols/keep.xml';
import SmartToy from '@expo/material-symbols/smart_toy.xml';

export const MEMO_TOOLBAR_ICON = {
  pin: process.env.EXPO_OS === 'ios' ? 'pin' : Keep,
  pinned: process.env.EXPO_OS === 'ios' ? 'pin.fill' : Keep,
  save: process.env.EXPO_OS === 'ios' ? 'checkmark' : Check,
  ai: process.env.EXPO_OS === 'ios' ? 'sparkles' : SmartToy,
  convertToTodo: process.env.EXPO_OS === 'ios' ? 'checkmark.square' : CheckBox,
  delete: process.env.EXPO_OS === 'ios' ? 'trash' : Delete,
} as const;
