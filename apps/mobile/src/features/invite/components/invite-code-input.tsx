import { INVITE_CODE } from '@aido/api';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { noop } from 'es-toolkit';
import { times } from 'es-toolkit/compat';
import { InputOTP, REGEXP_ONLY_DIGITS_AND_CHARS } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
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
}

/** 6자리 초대 코드 입력. 붙여 넣거나 소문자로 쳐도 서버와 같은 형태로 맞춘다 */
export function InviteCodeInput({
  value,
  onChange = noop,
  isInvalid = false,
  textInputProps,
  ...props
}: InviteCodeInputProps) {
  const translateX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.get() }] }));

  // 틀렸을 때 칸을 좌우로 흔들어 알린다(transform만 바꿔 UI 스레드에서 돈다)
  useEffect(() => {
    if (!isInvalid) {
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
  }, [isInvalid, translateX]);

  return (
    <Animated.View style={shakeStyle}>
      <InputOTP
        maxLength={INVITE_CODE.LENGTH}
        value={value}
        onChange={(text) => onChange(toInviteCodeDraft(text))}
        pasteTransformer={toInviteCodeDraft}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        inputMode="text"
        isInvalid={isInvalid}
        textInputProps={{
          autoCapitalize: 'characters',
          autoCorrect: false,
          autoComplete: 'off',
          spellCheck: false,
          ...textInputProps,
        }}
        {...props}
      >
        <InputOTP.Group className="w-full gap-2">
          {times(INVITE_CODE.LENGTH, (index) => (
            <InputOTP.Slot key={index} index={index} className="h-14 flex-1" />
          ))}
        </InputOTP.Group>
      </InputOTP>
    </Animated.View>
  );
}
