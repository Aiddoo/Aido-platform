import { VERIFICATION_CODE } from '@aido/api';
import { times } from 'es-toolkit/compat';
import { InputOTP } from 'heroui-native';
import type { ComponentProps } from 'react';

interface VerificationCodeInputProps extends Omit<
  ComponentProps<typeof InputOTP>,
  'maxLength' | 'children'
> {
  /** 코드를 절반씩 나누고 가운데 구분선을 보여 준다. */
  isSeparated?: boolean;
}

/** 서버 인증 코드 길이만큼 칸을 만드는 인증 코드 입력 */
export function VerificationCodeInput({
  isSeparated = false,
  ...props
}: VerificationCodeInputProps) {
  const half = Math.ceil(VERIFICATION_CODE.LENGTH / 2);

  return (
    <InputOTP maxLength={VERIFICATION_CODE.LENGTH} {...props}>
      {isSeparated ? (
        <>
          <InputOTP.Group>
            {times(half, (index) => (
              <InputOTP.Slot key={index} index={index} />
            ))}
          </InputOTP.Group>
          <InputOTP.Separator />
          <InputOTP.Group>
            {times(VERIFICATION_CODE.LENGTH - half, (offset) => (
              <InputOTP.Slot key={half + offset} index={half + offset} />
            ))}
          </InputOTP.Group>
        </>
      ) : (
        <InputOTP.Group>
          {times(VERIFICATION_CODE.LENGTH, (index) => (
            <InputOTP.Slot key={index} index={index} />
          ))}
        </InputOTP.Group>
      )}
    </InputOTP>
  );
}
