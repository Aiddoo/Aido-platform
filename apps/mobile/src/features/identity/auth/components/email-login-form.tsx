import { zodResolver } from '@hookform/resolvers/zod';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Input,
  KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET,
  KeyboardAdaptiveButton,
  Spacing,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { useEmailLoginMutationOptions } from '../queries/auth.mutations';
import { emailLoginFormSchema } from '../schemas/email-login-form.schema';
import { PasswordInput } from './password-input';

const NEXT_FIELD_OFFSET = 52;

interface EmailLoginFormProps {
  children: ReactNode;
  footer: ReactNode;
}

export function EmailLoginForm({ children, footer }: EmailLoginFormProps) {
  const { t } = useTranslation('auth');
  const reportUnexpectedError = useReportUnexpectedError('auth');
  const emailLogin = useMutation(useEmailLoginMutationOptions());
  const [viewportHeight, setViewportHeight] = useState(0);
  const form = useForm({
    resolver: zodResolver(emailLoginFormSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });
  const { isSubmitting } = useFormState({ control: form.control });

  const submitEmailLogin = form.handleSubmit(async (values) => {
    try {
      await emailLogin.mutateAsync({ email: values.email, password: values.password });
    } catch (error) {
      reportUnexpectedError(error);
    }
  });

  return (
    <>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET + NEXT_FIELD_OFFSET}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        {/* 내용 전체를 가운데 두면 키보드 높이만큼 끼는 여백에 스크롤 계산이 어긋나 화면 높이만 가운데 둔다 */}
        <StyledSafeAreaView
          edges={['left', 'right']}
          className="justify-center pb-10"
          style={{ minHeight: viewportHeight }}
        >
          {children}

          <Controller
            control={form.control}
            name="email"
            render={({ field: { ref, onChange, onBlur, value }, fieldState: { error } }) => (
              <Input
                ref={ref}
                testID="email-login-email"
                placeholder={t('emailLogin.emailPlaceholder')}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                submitBehavior="submit"
                isInvalid={!!error}
                errorMessage={resolveValidationMessage(error, {
                  default: 'email.invalid',
                  byType: { too_big: 'email.tooLong' },
                })}
                onSubmitEditing={() => form.setFocus('password')}
              />
            )}
          />

          <Spacing size={4} />

          <Controller
            control={form.control}
            name="password"
            render={({ field: { ref, onChange, onBlur, value }, fieldState: { error } }) => (
              <PasswordInput
                testID="email-login-password"
                ref={ref}
                placeholder={t('emailLogin.passwordPlaceholder')}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                textContentType="password"
                autoComplete="password"
                returnKeyType="done"
                submitBehavior="submit"
                isInvalid={!!error}
                errorMessage={resolveValidationMessage(error, { default: 'password.required' })}
                onSubmitEditing={() => {
                  if (!isSubmitting) {
                    submitEmailLogin();
                  }
                }}
              />
            )}
          />

          {footer}
        </StyledSafeAreaView>
      </KeyboardAwareScrollView>

      <KeyboardAdaptiveButton
        testID="email-login-submit"
        color="primary"
        onPress={() => submitEmailLogin()}
        isLoading={isSubmitting}
      >
        {t('emailLogin.submit')}
      </KeyboardAdaptiveButton>
    </>
  );
}
