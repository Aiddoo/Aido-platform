import { zodResolver } from '@hookform/resolvers/zod';
import type { TodoItem } from '@src/features/todo/models/todo.model';
import { isApiError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { Box } from '@src/shared/ui/Box/Box';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { H4 } from '@src/shared/ui/Text/Typography';
import { TextArea } from '@src/shared/ui/TextArea';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation } from '@tanstack/react-query';
import { Dialog } from 'heroui-native';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Platform } from 'react-native';
import { sendTodoNudgeMutationOptions } from '../queries/send-todo-nudge-mutation-options';
import { type NudgeFormInput, nudgeFormSchema } from '../schemas/nudge-form.schema';

interface NudgeDialogProps {
  friend: { userId: string; name: string };
  todo: TodoItem;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NudgeDialog({ friend, todo, isOpen, onOpenChange }: NudgeDialogProps) {
  const toast = useAppToast();
  const sendNudgeMutation = useMutation(sendTodoNudgeMutationOptions());
  const { control, handleSubmit, reset } = useForm<NudgeFormInput>({
    resolver: zodResolver(nudgeFormSchema),
    defaultValues: { message: '' },
  });

  const onSubmit = (data: NudgeFormInput) => {
    sendNudgeMutation.mutate(
      {
        receiverId: friend.userId,
        todoId: todo.id,
        message: data.message?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('콕 찔렀어요!');
          onOpenChange(false);
        },
        onError: (error) => {
          if (isApiError(error)) {
            toast.error(error.message);
            return;
          }
          toast.error(undefined, { fallback: '잠시 후 다시 시도해 주세요' });
        },
      },
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/40" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Dialog.Content>
            <Dialog.Title>
              <VStack>
                <Text size="b4" shade={6}>
                  할 일을 잊은 {friend.name}님에게
                </Text>
                <H4>따끔하게 콕 찌르기</H4>
              </VStack>
            </Dialog.Title>

            <Spacing size={20} />

            <Box className="relative">
              <Image
                source={require('@assets/images/aido_banner.webp')}
                style={{ width: 84, height: 84 }}
                resizeMode="contain"
                className="absolute top-[-56px] right-2"
              />
              <Controller
                control={control}
                name="message"
                render={({ field: { onChange, value } }) => (
                  <TextArea
                    label={`to. ${friend.name}`}
                    placeholder={`${todo.title} 언제 할 거야?`}
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
            </Box>

            <Spacing size={20} />

            <HStack gap={8} className="w-full" justify="center">
              <Dialog.Close asChild>
                <Button
                  variant="weak"
                  color="dark"
                  size="large"
                  display="inline"
                  className="flex-1"
                >
                  취소
                </Button>
              </Dialog.Close>
              <Button
                color="primary"
                size="large"
                display="inline"
                className="flex-1"
                onPress={handleSubmit(onSubmit)}
                isLoading={sendNudgeMutation.isPending}
              >
                콕 찌르기
              </Button>
            </HStack>
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
