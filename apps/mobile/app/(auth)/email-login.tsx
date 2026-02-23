import idoCatHiImage from '@assets/images/ido_cat_hi.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/auth/presentations/components/PasswordInput';
import { emailLoginMutationOptions } from '@src/features/auth/presentations/queries/email-login-mutation-options';
import {
  type EmailLoginFormData,
  emailLoginFormSchema,
} from '@src/features/auth/presentations/schemas/email-login-form.schema';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Input } from '@src/shared/ui/Input';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { H3 } from '@src/shared/ui/Text/Typography';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Image, type TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

// TODO: 비밀번호 찾기 기능 추가
const EmailLoginScreen = () => {
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

  const emailLoginMutation = useMutation(emailLoginMutationOptions());

  const onSubmit = handleSubmit((data) => {
    emailLoginMutation.mutate({ email: data.email, password: data.password });
  });

  return (
    <View className="flex-1 bg-background" style={{ overflow: 'hidden' }}>
      <Image
        source={idoCatHiImage}
        style={{
          width: 100,
          height: 100,
          position: 'absolute',
          right: 0,
          top: 0,
          transform: [{ translateX: 20 }, { translateY: 20 }, { rotate: '-60deg' }],
          zIndex: 1,
        }}
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
        <H3 align="center">로그인</H3>

        <Spacing size={60} />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="이메일"
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
              errorMessage={errors.email?.message}
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
              placeholder="비밀번호"
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
          로그인
        </Button>

        <Spacing size={24} />

        <HStack justify="center" align="center" gap={8}>
          <TextButton size="medium" onPress={() => router.push('/sign-up')}>
            회원가입
          </TextButton>
          <Separator orientation="vertical" className="h-3 bg-gray-6" />
          <TextButton
            size="medium"
            onPress={() => Alert.alert('안내', '비밀번호 찾기 기능은 준비 중이에요')}
          >
            비밀번호 찾기
          </TextButton>
        </HStack>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default EmailLoginScreen;
