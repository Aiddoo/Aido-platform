import { emailLoginMutationOptions } from '@src/features/auth/presentations/queries/email-login-mutation-options';
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
  Avatar,
  Dialog,
  Divider,
  Button as HeroButton,
  PressableFeedback,
  TextField,
} from 'heroui-native';
import { useState } from 'react';

const EmailLoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorDialog, setErrorDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const emailLoginMutation = useMutation(emailLoginMutationOptions());

  const showError = (title: string, message: string) => {
    setErrorDialog({ isOpen: true, title, message });
  };

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      showError('오류', '이메일과 비밀번호를 입력해주세요');
      return;
    }

    emailLoginMutation.mutate(
      { email: email.trim(), password },
      {
        onError: (error) => {
          showError('로그인 실패', error.message || '로그인에 실패했습니다');
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
            <VStack gap={16}>
              <TextField>
                <TextField.Label>이메일</TextField.Label>
                <TextField.Input
                  placeholder="example@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </TextField>

              <TextField>
                <TextField.Label>비밀번호</TextField.Label>
                <TextField.Input
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
          <Divider orientation="vertical" className="mx-2 h-3 bg-gray-4" />
          <PressableFeedback onPress={() => {}}>
            <Text size="e1" shade={9} weight="semibold">
              회원가입
            </Text>
          </PressableFeedback>
        </HStack>
      </VStack>

      {/* Error Dialog */}
      <Dialog
        isOpen={errorDialog.isOpen}
        onOpenChange={(isOpen) => setErrorDialog((prev) => ({ ...prev, isOpen }))}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40" />
          <Dialog.Content>
            <VStack gap={16}>
              <VStack gap={4}>
                <Dialog.Title>{errorDialog.title}</Dialog.Title>
                <Dialog.Description>{errorDialog.message}</Dialog.Description>
              </VStack>
              <HStack justify="end">
                <Dialog.Close asChild>
                  <HeroButton size="sm">확인</HeroButton>
                </Dialog.Close>
              </HStack>
            </VStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </StyledSafeAreaView>
  );
};

export default EmailLoginScreen;
