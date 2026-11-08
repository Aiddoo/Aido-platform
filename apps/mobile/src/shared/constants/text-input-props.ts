import { type TextInputProps } from 'react-native';

/** iOS ascii-capable, Android는 추천 단어 없는 visible-password로 영문 자판을 띄운다 */
export const ASCII_CODE_TEXT_INPUT_PROPS = {
  keyboardType: process.env.EXPO_OS === 'ios' ? 'ascii-capable' : 'visible-password',
  autoCapitalize: 'characters',
  autoCorrect: false,
  autoComplete: 'off',
  spellCheck: false,
} as const satisfies TextInputProps;
