import { INVITE_CODE } from '@aido/api/vocabulary';
import { ANIMATION } from '@src/shared/constants/animation';
import { ASCII_CODE_TEXT_INPUT_PROPS } from '@src/shared/constants/text-input-props';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { HStack, InfoIcon, Spacing, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { range } from 'es-toolkit';
import { InputOTP, REGEXP_ONLY_DIGITS_AND_CHARS } from 'heroui-native';
import { type ComponentProps, useEffect } from 'react';
import type { FieldError } from 'react-hook-form';
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

import { getInvalidCharacters } from '../domains/invite-code.model';
import { INVITE_CODE_SERVER_ERROR_TYPE } from '../domains/invite.error';
import {
  normalizeInviteCodeInput,
  normalizePastedInviteCode,
} from '../schemas/invite-code-form.schema';
import {
  type InvalidCharacterSummary,
  summarizeInvalidCharacters,
} from '../utils/invite-code.view-model';

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
  'value' | 'onChange' | 'maxLength' | 'children' | 'isInvalid'
> {
  value: string;
  onChange: (value: string) => void;
  /** 코드 칸 오류. 서버가 거절한 코드는 `INVITE_CODE_SERVER_ERROR_TYPE`이고 서버 문구를 싣는다 */
  error: FieldError | undefined;
  /** 제출 횟수. 고치지 않고 다시 제출해 같은 오류가 남아도 바뀔 때마다 다시 흔든다 */
  submitCount: number;
  /** Android는 투명도 0인 숨은 입력을 화면 트리에서 빼므로 칸 묶음으로, iOS는 숨은 입력으로 찾는다 */
  testID?: string;
}

export function InviteCodeInput({
  value,
  onChange,
  error,
  submitCount,
  textInputProps,
  testID,
  ...props
}: InviteCodeInputProps) {
  const { t } = useTranslation('invite');
  const fontScaledSize = useFontScaledSize();
  const invalidCharacters = getInvalidCharacters(value);

  const formatInvalidCharacterMessage = ({
    kind,
    listedCharacters,
    uniqueCount,
  }: InvalidCharacterSummary) => {
    const quotedCharacters = listedCharacters.map((character) => `‘${character}’`).join(', ');
    const characters =
      uniqueCount > listedCharacters.length
        ? t('codeEntry.invalidCharacter.more', { characters: quotedCharacters })
        : quotedCharacters;

    return kind === 'confusable'
      ? t('codeEntry.invalidCharacter.confusable', { characters, count: uniqueCount })
      : t('codeEntry.invalidCharacter.unused', { characters, count: uniqueCount });
  };

  // 덜 채운 코드(too_small)는 문구 없이 버튼만 끈다. 서버가 거절한 코드는 서버 문구, 없는 글자는 그 글자를 짚는다
  const findErrorMessage = (fieldError: FieldError | undefined) => {
    if (fieldError == null || fieldError.type === 'too_small') {
      return null;
    }
    if (fieldError.type === INVITE_CODE_SERVER_ERROR_TYPE) {
      return fieldError.message ?? t('errors.invalidCode', { count: INVITE_CODE.LENGTH });
    }
    const invalidCharacterSummary = summarizeInvalidCharacters(invalidCharacters);
    return invalidCharacterSummary == null
      ? t('errors.invalidCode', { count: INVITE_CODE.LENGTH })
      : formatInvalidCharacterMessage(invalidCharacterSummary);
  };

  const errorMessage = findErrorMessage(error);
  const invalidIndexes =
    errorMessage == null ? [] : invalidCharacters.map((invalidCharacter) => invalidCharacter.index);
  // 틀린 글자가 있으면 그 칸만, 없는 코드처럼 전체가 틀렸으면 모든 칸을 빨갛게 그린다
  const isInvalid = errorMessage != null && invalidIndexes.length === 0;
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
    <>
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

      {errorMessage != null && (
        <>
          <Spacing size={12} />
          <HStack
            gap={6}
            align="center"
            accessibilityRole="alert"
            testID="invite-code-error"
            accessibilityLiveRegion="polite"
          >
            <InfoIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-error"
            />
            <Text
              size="b4"
              weight="semibold"
              tone="danger"
              lineBreakStrategyIOS="hangul-word"
              className="flex-1"
            >
              {errorMessage}
            </Text>
          </HStack>
        </>
      )}
    </>
  );
}
