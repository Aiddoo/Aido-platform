import idoCatHiImage from '@assets/images/ido_cat_hi.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/auth/presentations/components/PasswordInput';
import { useEmailLoginMutationOptions } from '@src/features/auth/presentations/queries/use-email-login-mutation-options';
import {
  type EmailLoginFormData,
  emailLoginFormSchema,
} from '@src/features/auth/presentations/schemas/email-login-form.schema';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Button, H3, HStack, Input, Spacing, TextButton } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, type TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

const EmailLoginScreen = () => {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('auth');
  const passwordRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailLoginFormData>({
    resolver: zodResolver(emailLoginFormSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const emailLoginMutation = useMutation(useEmailLoginMutationOptions());

  const onSubmit = handleSubmit((data) => {
    emailLoginMutation.mutate({ email: data.email, password: data.password });
  });

  return (
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

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder={t('emailLogin.emailPlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              submitBehavior="submit"
              isInvalid={!!errors.email}
              errorMessage={resolveValidationMessage(errors.email, {
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
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordInput
              ref={passwordRef}
              placeholder={t('emailLogin.passwordPlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              textContentType="password"
              autoComplete="password"
              returnKeyType="done"
              submitBehavior="submit"
              isInvalid={!!errors.password}
              errorMessage={errors.password?.message}
              onSubmitEditing={onSubmit}
            />
          )}
        />

        <Spacing size={16} />

        <Button color="primary" onPress={onSubmit} isLoading={emailLoginMutation.isPending}>
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
  );
};

export default EmailLoginScreen;
