import idoCatHiImage from '@assets/images/ido_cat_hi.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/auth/presentations/components/PasswordInput';
import { useEmailLoginMutationOptions } from '@src/features/auth/presentations/queries/use-email-login-mutation-options';
import { emailLoginFormSchema } from '@src/features/auth/presentations/schemas/email-login-form.schema';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Button, H3, HStack, Input, Spacing, TextButton } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import type { ComponentRef } from 'react';
import { useRef } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Image, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

const EmailLoginScreen = () => {
  const { showBoundary } = useErrorBoundary();

  const push = useSingleTap(router.push);

  const { t } = useTranslation('auth');
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const formMethods = useForm({
    resolver: zodResolver(emailLoginFormSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });
  const { control, handleSubmit } = formMethods;
  const { isSubmitting } = useFormState({ control: control });

  const emailLoginMutation = useMutation(useEmailLoginMutationOptions());

  const onSubmit = handleSubmit(async (data) => {
    try {
      await emailLoginMutation.mutateAsync({ email: data.email, password: data.password });
    } catch (error) {
      if (!isBusinessError(error)) showBoundary(error);
    }
  });

  return (
    <FormProvider {...formMethods}>
      <View className="flex-1 overflow-hidden bg-background">
        <Image
          source={idoCatHiImage}
          className="absolute right-0 top-0 z-10 h-[100px] w-[100px]"
          style={{ transform: [{ translateX: 20 }, { translateY: 20 }, { rotate: '-60deg' }] }}
          resizeMode="contain"
        />
        <KeyboardAwareScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 40,
            flexGrow: 1,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
                errorMessage={error?.message}
                onSubmitEditing={() => onSubmit()}
              />
            )}
          </FormField>

          <Spacing size={16} />

          <Button
            testID="email-login-submit"
            color="primary"
            onPress={() => onSubmit()}
            isLoading={isSubmitting}
          >
            {t('emailLogin.submit')}
          </Button>

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
        </KeyboardAwareScrollView>
      </View>
    </FormProvider>
  );
};

export default EmailLoginScreen;
