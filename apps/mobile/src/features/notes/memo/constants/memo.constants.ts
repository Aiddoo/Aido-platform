import Check from '@expo/material-symbols/check.xml';
import CheckBox from '@expo/material-symbols/check_box.xml';
import Delete from '@expo/material-symbols/delete.xml';
import Keep from '@expo/material-symbols/keep.xml';
import SmartToy from '@expo/material-symbols/smart_toy.xml';

const IS_IOS = process.env.EXPO_OS === 'ios';

/** 메모 화면 네이티브 헤더 버튼 아이콘. iOS는 SF Symbol, Android는 Material Symbol을 쓴다. */
export const MEMO_TOOLBAR_ICON = {
  pin: IS_IOS ? 'pin' : Keep,
  pinned: IS_IOS ? 'pin.fill' : Keep,
  save: IS_IOS ? 'checkmark' : Check,
  ai: IS_IOS ? 'sparkles' : SmartToy,
  convertToTodo: IS_IOS ? 'checkmark.square' : CheckBox,
  delete: IS_IOS ? 'trash' : Delete,
} as const;
