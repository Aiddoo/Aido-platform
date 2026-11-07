import idoCatHiImage from '@assets/images/ido_cat_hi.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/identity/auth/components/password-input';
import { useEmailLoginMutationOptions } from '@src/features/identity/auth/queries/auth.mutations';
import { emailLoginFormSchema } from '@src/features/identity/auth/schemas/email-login-form.schema';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
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
  StyledSafeAreaView,
  Box,
  Image,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import type { ComponentRef } from 'react';
import { useRef, useState } from 'react';
import { FormProvider, useFormState, useForm, Controller } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

/** 이메일 칸에 있을 때 아래 비밀번호 칸까지 버튼 위에 보여 바로 누를 수 있게 조금 더 올린다 */
const NEXT_FIELD_OFFSET = 52;

export default function EmailLoginScreen() {
  const reportUnexpectedError = useReportUnexpectedError('auth');

  const push = useSingleTap(router.push);

  const { t } = useTranslation('auth');
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [viewportHeight, setViewportHeight] = useState(0);

  const form = useForm({
    resolver: zodResolver(emailLoginFormSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });
  const { control, handleSubmit } = form;
  const { isSubmitting } = useFormState({ control });

  const emailLoginMutation = useMutation(useEmailLoginMutationOptions());

  const handleSubmitEmailLogin = handleSubmit(async (values) => {
    try {
      await emailLoginMutation.mutateAsync({ email: values.email, password: values.password });
    } catch (error) {
      reportUnexpectedError(error);
    }
  });

  return (
    <FormProvider {...form}>
      <Box className="flex-1 overflow-hidden bg-white">
        <Image
          source={idoCatHiImage}
          className="absolute right-0 top-0 z-10 h-[100px] w-[100px]"
          style={{ transform: [{ translateX: 20 }, { translateY: 20 }, { rotate: '-60deg' }] }}
          contentFit="contain"
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

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
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
              />

              <Spacing size={4} />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
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
              />

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
