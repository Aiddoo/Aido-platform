import idoCatHiImage from '@assets/images/ido_cat_hi.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/identity/auth/components/password-input';
import { emailLoginFormSchema } from '@src/features/identity/auth/domains/email-login-form.schema';
import { useEmailLoginMutationOptions } from '@src/features/identity/auth/queries/use-email-login-mutation-options';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  H3,
  HStack,
  Input,
  KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET,
  KeyboardAdaptiveButton,
  ReadableContent,
  Spacing,
  TextButton,
  QueryErrorBoundary,
  StyledSafeAreaView,
  Box,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import type { ComponentRef } from 'react';
import { useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useFormState, useForm } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

/** 이메일 칸에 있을 때 아래 비밀번호 칸까지 버튼 위에 보여 바로 누를 수 있게 조금 더 올린다 */
const NEXT_FIELD_OFFSET = 52;

function EmailLoginScreen() {
  const { showBoundary } = useErrorBoundary();

  const push = useSingleTap(router.push);

  const { t } = useTranslation('auth');
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [viewportHeight, setViewportHeight] = useState(0);

  const formMethods = useForm({
    resolver: zodResolver(emailLoginFormSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });
  const { control, handleSubmit } = formMethods;
  const { isSubmitting } = useFormState({ control });

  const emailLoginMutation = useMutation(useEmailLoginMutationOptions());

  const handleSubmitEmailLogin = handleSubmit(async (values) => {
    try {
      await emailLoginMutation.mutateAsync({ email: values.email, password: values.password });
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  });

  return (
    <FormProvider {...formMethods}>
      <Box className="flex-1 overflow-hidden bg-white">
        <Image
          source={idoCatHiImage}
          className="absolute right-0 top-0 z-10 h-[100px] w-[100px]"
          style={{ transform: [{ translateX: 20 }, { translateY: 20 }, { rotate: '-60deg' }] }}
          resizeMode="contain"
        />
        <ReadableContent flex={1}>
          <KeyboardAwareScrollView
            bottomOffset={KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET + NEXT_FIELD_OFFSET}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
          >
            {/* 스크롤 내용 전체를 가운데 두면 키보드 높이만큼 끼는 여백에 칸이 함께 밀려 스크롤 계산이 어긋난다. 화면 높이만 가운데 둔다 */}
            <StyledSafeAreaView
              edges={['left', 'right']}
              className="justify-center pb-10"
              style={{ minHeight: viewportHeight }}
            >
              <H3 align="center">{t('emailLogin.title')}</H3>

              <Spacing size={60} />

              <FormField control={control} name="email">
                {({ onChange, onBlur, value }, { error }) => (
                  <Input
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
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                )}
              </FormField>

              <Spacing size={4} />

              <FormField control={control} name="password">
                {({ onChange, onBlur, value }, { error }) => (
                  <PasswordInput
                    testID="email-login-password"
                    ref={passwordRef}
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
                    onSubmitEditing={() => handleSubmitEmailLogin()}
                  />
                )}
              </FormField>

              <Spacing size={24} />

              <HStack justify="center" align="center" gap={8}>
                <TextButton size="medium" onPress={() => push('/sign-up')}>
                  {t('emailLogin.signUp')}
                </TextButton>
                <Separator orientation="vertical" className="h-3 bg-gray-6" />
                <TextButton size="medium" onPress={() => push('/(auth)/forgot-password')}>
                  {t('emailLogin.forgotPassword')}
                </TextButton>
              </HStack>
            </StyledSafeAreaView>
          </KeyboardAwareScrollView>

          <KeyboardAdaptiveButton
            testID="email-login-submit"
            color="primary"
            onPress={() => handleSubmitEmailLogin()}
            isLoading={isSubmitting}
          >
            {t('emailLogin.submit')}
          </KeyboardAdaptiveButton>
        </ReadableContent>
      </Box>
    </FormProvider>
  );
}

/** 제출 중 예측하지 못한 오류(showBoundary)를 이 화면 안에서 받아 다시 시도하게 한다. */
export default function EmailLoginRoute() {
  return (
    <QueryErrorBoundary>
      <EmailLoginScreen />
    </QueryErrorBoundary>
  );
}
