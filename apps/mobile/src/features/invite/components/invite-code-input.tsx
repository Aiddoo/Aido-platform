import { INVITE_CODE } from '@aido/api';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { cn } from '@src/shared/utils/cn';
import { noop } from 'es-toolkit';
import { times } from 'es-toolkit/compat';
import { InputOTP, REGEXP_ONLY_DIGITS_AND_CHARS } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
import { Platform, type TextInputProps } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { toInviteCodeDraft } from '../domains/invite.model';

/**
 * 한글 자판 대신 영문·숫자 자판을 띄운다(iOS ascii-capable, Android는 추천 단어 없는 visible-password).
 * InputOTP는 inputMode(기본 numeric)를 늘 넘기고 RN은 inputMode가 있으면 keyboardType을 무시하므로,
 * 마지막에 펼쳐지는 textInputProps에서 inputMode를 비운다. 소문자로 쳐도 toInviteCodeDraft가 대문자로 맞춘다.
 */
const CODE_TEXT_INPUT_PROPS: TextInputProps = {
  inputMode: undefined,
  keyboardType: Platform.select({ ios: 'ascii-capable', android: 'visible-password' }),
  autoCapitalize: 'characters',
  autoCorrect: false,
  autoComplete: 'off',
  spellCheck: false,
};

const SHAKE_OFFSET = 6;
const SHAKE_TIMING = {
  duration: ANIMATION.duration.fast / 2,
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
}

/** 6자리 초대 코드 입력. 붙여 넣거나 소문자로 쳐도 서버와 같은 형태로 맞춘다 */
export function InviteCodeInput({
  value,
  onChange = noop,
  isInvalid = false,
  invalidIndexes = [],
  textInputProps,
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

    return () => cancelAnimation(translateX);
  }, [shouldShake, translateX]);

  return (
    <Animated.View style={shakeStyle}>
      <InputOTP
        maxLength={INVITE_CODE.LENGTH}
        value={value}
        onChange={(text) => onChange(toInviteCodeDraft(text))}
        pasteTransformer={toInviteCodeDraft}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        isInvalid={isInvalid}
        textInputProps={{ ...CODE_TEXT_INPUT_PROPS, ...textInputProps }}
        {...props}
      >
        <InputOTP.Group className="w-full gap-2">
          {times(INVITE_CODE.LENGTH, (index) => (
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
