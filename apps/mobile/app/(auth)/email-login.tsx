import { ErrorCode } from '@aido/errors';
import { emailLoginMutationOptions } from '@src/features/auth/presentations/queries/email-login-mutation-options';
import { isApiError } from '@src/shared/errors';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowLeftIcon } from '@src/shared/ui/Icon';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Text } from '@src/shared/ui/Text/Text';
import { H1 } from '@src/shared/ui/Text/Typography';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Alert,
  Avatar,
  Input,
  Label,
  PressableFeedback,
  Separator,
  TextField,
} from 'heroui-native';
import { useState } from 'react';

const EmailLoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailLoginMutation = useMutation(emailLoginMutationOptions());

  const handleLogin = () => {
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('이메일과 비밀번호를 입력해주세요');
      return;
    }

    emailLoginMutation.mutate(
      { email: email.trim(), password },
      {
        onError: (error) => {
          if (isApiError(error) && error.hasCode(ErrorCode.EMAIL_0503)) {
            router.push({ pathname: './verify-email', params: { email: email.trim() } });
            return;
          }
          setErrorMessage(error.message || '로그인에 실패했습니다');
        },
      },
    );
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <VStack flex={1} px={16}>
        {/* Header */}
        <HStack align="center" py={12}>
          <PressableFeedback onPress={() => router.back()}>
            <ArrowLeftIcon width={24} height={24} colorClassName="text-gray-9" />
          </PressableFeedback>
        </HStack>

        {/* Content */}
        <VStack flex={1} justify="center" gap={40}>
          {/* Logo & Title */}
          <VStack align="center" gap={8}>
            <Avatar alt="Aido logo" size="lg" className="rounded-xl">
              <Avatar.Image source={require('@assets/images/icon.png')} />
            </Avatar>
            <VStack align="center">
              <H1>이메일 로그인</H1>
              <Text size="b4" shade={6}>
                등록된 계정으로 로그인하세요
              </Text>
            </VStack>
          </VStack>

          {/* Form */}
          <VStack gap={24}>
            {errorMessage && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{errorMessage}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <VStack gap={16}>
              <TextField>
                <Label>이메일</Label>
                <Input
                  placeholder="example@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </TextField>

              <TextField>
                <Label>비밀번호</Label>
                <Input
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </TextField>
            </VStack>

            <Button onPress={handleLogin} isLoading={emailLoginMutation.isPending}>
              로그인
            </Button>
          </VStack>
        </VStack>

        {/* Footer */}
        <HStack justify="center" align="center" pb={40}>
          <Text size="e1" shade={5}>
            계정이 없으신가요?
          </Text>
          <Separator orientation="vertical" className="mx-2 h-3 bg-gray-4" />
          <PressableFeedback onPress={() => router.push('/sign-up')}>
            <Text size="e1" shade={9} weight="semibold">
              회원가입
            </Text>
          </PressableFeedback>
        </HStack>
      </VStack>
    </StyledSafeAreaView>
  );
};

export default EmailLoginScreen;
