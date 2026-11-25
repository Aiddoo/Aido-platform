import Check from '@expo/material-symbols/check.xml';
import CheckBox from '@expo/material-symbols/check_box.xml';
import Delete from '@expo/material-symbols/delete.xml';
import Keep from '@expo/material-symbols/keep.xml';
import SmartToy from '@expo/material-symbols/smart_toy.xml';
import { nativeIcon } from '@src/shared/ui';

export const MEMO_TOOLBAR_ICON = {
  pin: nativeIcon({ ios: 'pin', android: Keep }),
  pinned: nativeIcon({ ios: 'pin.fill', android: Keep }),
  save: nativeIcon({ ios: 'checkmark', android: Check }),
  ai: nativeIcon({ ios: 'sparkles', android: SmartToy }),
  convertToTodo: nativeIcon({ ios: 'checkmark.square', android: CheckBox }),
  delete: nativeIcon({ ios: 'trash', android: Delete }),
} as const;
