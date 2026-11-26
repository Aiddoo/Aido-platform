import { zodResolver } from '@hookform/resolvers/zod';
import { AuthLinkRow } from '@src/features/identity/auth/components/auth-link-row';
import { PasswordInput } from '@src/features/identity/auth/components/password-input';
import { isEmailNotVerifiedError } from '@src/features/identity/auth/domains/auth.error';
import { useEmailLoginMutationOptions } from '@src/features/identity/auth/queries/auth.mutations';
import { emailLoginFormSchema } from '@src/features/identity/auth/schemas/email-login-form.schema';
import { useLayoutSize } from '@src/shared/hooks/use-layout-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Box,
  FormScrollView,
  H3,
  Input,
  KeyboardAdaptiveButton,
  Mascot,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  TextButton,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useNavigation, useRouter } from 'expo-router';
import { Controller, FormState, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EmailLoginScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const navigation = useNavigation();
  const push = useSingleTap(router.push);
  const { right: rightInset } = useSafeAreaInsets();
  const [viewportSize, handleViewportLayout] = useLayoutSize();
  const emailLogin = useMutation(useEmailLoginMutationOptions());
  const form = useForm({
    resolver: zodResolver(emailLoginFormSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  // 인증 화면에 스키마가 다듬은 주소를 넘기려 실패를 제출 안에서 받고, RHF가 실패로 알아 다시 누를 수 있게 다시 던진다
  const submitEmailLogin = form.handleSubmit(async ({ email, password }) => {
    try {
      await emailLogin.mutateAsync({ email, password });
    } catch (error) {
      // 그 밖의 실패 안내는 mutation의 meta.errorFeedback이 맡는다. 기다리는 사이 떠났으면 보던 화면 위에 올리지 않는다
      if (isEmailNotVerifiedError(error) && navigation.isFocused()) {
        push({ pathname: '/(auth)/verify-email', params: { email } });
      }
      throw error;
    }
  });
  // 같은 프레임의 두 번째 탭은 isSubmitting이 다음 렌더에야 켜져 여기서 막는다
  const handleLoginPress = useSingleTap(() => {
    submitEmailLogin().catch(noop);
  });

  return (
    <Box className="flex-1 overflow-hidden bg-white">
      <Mascot
        name="catHi"
        size={100}
        className="absolute top-0 z-10"
        style={{
          right: rightInset,
          transform: [{ translateX: 20 }, { translateY: 20 }, { rotate: '-60deg' }],
        }}
      />
      <ReadableContent flex={1}>
        <FormScrollView
          contentContainerStyle={{ paddingHorizontal: 16 }}
          onLayout={handleViewportLayout}
          footer={
            <FormState
              control={form.control}
              render={({ isSubmitting, isSubmitSuccessful }) => (
                <KeyboardAdaptiveButton
                  testID="email-login-submit"
                  color="primary"
                  onPress={handleLoginPress}
                  // 로그인하면 인증 화면이 빠지는 동안에도 같은 값이 남는다. 그동안 다시 보내지 않는다
                  isLoading={isSubmitting || isSubmitSuccessful || emailLogin.isPending}
                >
                  {t('emailLogin.submit')}
                </KeyboardAdaptiveButton>
              )}
            />
          }
        >
          {/* 스크롤 내용 전체를 가운데 두면 키보드 높이만큼 끼는 여백에 칸이 함께 밀려 스크롤 계산이 어긋난다. 화면 높이만 가운데 둔다 */}
          <StyledSafeAreaView
            edges={['left', 'right']}
            className="justify-center pb-10"
            style={{ minHeight: viewportSize?.height ?? 0 }}
          >
            <H3 align="center">{t('emailLogin.title')}</H3>

            {/* oxlint-disable-next-line aido/spacing-scale -- 제목과 이메일 입력 사이 한 화면 전용 구역. 규격 단계 밖 60px을 쓴다 */}
            <Spacing size={60} />

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
                  isInvalid={error != null}
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
              render={({
                field: { ref, onChange, onBlur, value },
                fieldState: { error },
                formState: { isSubmitting, isSubmitSuccessful },
              }) => (
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
                  isInvalid={error != null}
                  errorMessage={resolveValidationMessage(error, { default: 'password.required' })}
                  onSubmitEditing={() => {
                    if (!isSubmitting && !isSubmitSuccessful) {
                      handleLoginPress();
                    }
                  }}
                />
              )}
            />

            <Spacing size={24} />

            <AuthLinkRow>
              <TextButton size="medium" onPress={() => push('/sign-up')}>
                {t('emailLogin.signUp')}
              </TextButton>
              <TextButton size="medium" onPress={() => push('/(auth)/forgot-password')}>
                {t('emailLogin.forgotPassword')}
              </TextButton>
            </AuthLinkRow>
          </StyledSafeAreaView>
        </FormScrollView>
      </ReadableContent>
    </Box>
  );
}
