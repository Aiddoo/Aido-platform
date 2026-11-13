import { INVITE_CODE } from '@aido/api/vocabulary';
import { ANIMATION } from '@src/shared/constants/animation';
import { ASCII_CODE_TEXT_INPUT_PROPS } from '@src/shared/constants/text-input-props';
import { cn } from '@src/shared/utils/cn';
import { noop, range } from 'es-toolkit';
import { InputOTP, REGEXP_ONLY_DIGITS_AND_CHARS } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
import type { TextInputProps } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { normalizeInviteCodeInput, normalizePastedInviteCode } from '../domains/invite-code.model';

/** InputOTP가 늘 넘기는 numeric inputMode를 비워 영문 자판을 띄우고 oneTimeCode 제안을 끈다. 붙여 넣은 글자는 네이티브 maxLength가 아니라 onChangeText가 자른다 */
const CODE_TEXT_INPUT_PROPS: TextInputProps = {
  ...ASCII_CODE_TEXT_INPUT_PROPS,
  inputMode: undefined,
  textContentType: 'none',
  maxLength: undefined,
};

const SHAKE_OFFSET = 6;
const SHAKE_TIMING = {
  duration: ANIMATION.durationMs.fast / 2,
  easing: Easing.bezier(0.77, 0, 0.175, 1),
  reduceMotion: ReduceMotion.System,
};

interface InviteCodeInputProps extends Omit<
  ComponentProps<typeof InputOTP>,
  'value' | 'onChange' | 'maxLength' | 'children'
> {
  value: string;
  onChange?: (value: string) => void;
  /** 틀린 글자가 있는 칸만 빨갛게 그린다. 코드 전체가 틀렸으면 isInvalid를 쓴다 */
  invalidIndexes?: readonly number[];
  /** 제출 횟수. 고치지 않고 다시 제출해 같은 오류가 남아도 바뀔 때마다 다시 흔든다 */
  submitCount?: number;
  /**
   * 숨은 입력과 칸 묶음에 함께 단다. Android는 투명도 0인 숨은 입력을 화면 트리에서 빼므로 칸 묶음으로 찾고,
   * iOS는 숨은 입력으로 찾는다.
   */
  testID?: string;
}

/** 6자리 초대 코드 입력. 붙여 넣거나 소문자로 쳐도 서버와 같은 형태로 맞춘다 */
export function InviteCodeInput({
  value,
  onChange = noop,
  isInvalid = false,
  invalidIndexes = [],
  submitCount = 0,
  textInputProps,
  testID,
  ...props
}: InviteCodeInputProps) {
  const shouldShake = isInvalid || invalidIndexes.length > 0;
  const translateX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.get() }] }));

  // 틀렸을 때 칸을 좌우로 흔들어 알린다(transform만 바꿔 UI 스레드에서 돈다)
  useEffect(() => {
    if (!shouldShake) {
      return;
    }

    translateX.set(
      withSequence(
        withTiming(-SHAKE_OFFSET, SHAKE_TIMING),
        withTiming(SHAKE_OFFSET, SHAKE_TIMING),
        withTiming(-SHAKE_OFFSET, SHAKE_TIMING),
        withTiming(0, SHAKE_TIMING),
      ),
    );

    return () => {
      cancelAnimation(translateX);
      translateX.set(0);
    };
  }, [shouldShake, submitCount, translateX]);

  return (
    <Animated.View style={shakeStyle} testID={testID} collapsable={false}>
      <InputOTP
        maxLength={INVITE_CODE.LENGTH}
        value={value}
        onChange={(text) => onChange(normalizeInviteCodeInput(text))}
        pasteTransformer={(pasted) => normalizePastedInviteCode(value, pasted)}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        isInvalid={isInvalid}
        textInputProps={{ ...CODE_TEXT_INPUT_PROPS, testID, ...textInputProps }}
        {...props}
      >
        <InputOTP.Group className="w-full gap-2">
          {range(INVITE_CODE.LENGTH).map((index) => (
            <InputOTP.Slot
              key={index}
              index={index}
              // HeroUI의 is-invalid와 같은 2px outline이라 테두리가 바뀌어도 칸 크기는 그대로다
              className={cn(
                'h-14 flex-1',
                invalidIndexes.includes(index) && 'outline-2 outline-danger',
              )}
            />
          ))}
        </InputOTP.Group>
      </InputOTP>
    </Animated.View>
  );
}
