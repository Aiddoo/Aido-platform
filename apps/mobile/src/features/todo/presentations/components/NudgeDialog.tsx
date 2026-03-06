import aidoBannerImage from '@assets/images/aido_banner.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FriendUserViewModel } from '@src/features/friend/presentations/view-models/friend-user.view-model';
import type { TodoItem } from '@src/features/todo/models/todo.model';
import { Box } from '@src/shared/ui/Box';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack';
import { Spacing } from '@src/shared/ui/Spacing';
import { H4, Text } from '@src/shared/ui/Text';
import { TextArea } from '@src/shared/ui/TextArea';
import { VStack } from '@src/shared/ui/VStack';
import { useMutation } from '@tanstack/react-query';
import { Dialog } from 'heroui-native';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useSendTodoNudgeMutationOptions } from '../queries/use-send-todo-nudge-mutation-options';
import { type NudgeFormInput, nudgeFormSchema } from '../schemas/nudge-form.schema';

interface NudgeDialogProps {
  friend: FriendUserViewModel;
  todo: TodoItem;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NudgeDialog({ friend, todo, isOpen, onOpenChange }: NudgeDialogProps) {
  const sendNudgeMutation = useMutation(useSendTodoNudgeMutationOptions());
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<NudgeFormInput>({
    resolver: zodResolver(nudgeFormSchema),
    defaultValues: { message: '' },
    mode: 'onChange',
  });

  const onSubmit = (data: NudgeFormInput) => {
    sendNudgeMutation.mutate(
      {
        receiverId: friend.id,
        todoId: todo.id,
        message: data.message,
      },
      {
        onSuccess: () => onOpenChange(false),
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
                  할 일을 잊은 {friend.displayName}님에게
                </Text>
                <H4>따끔하게 콕 찌르기</H4>
              </VStack>
            </Dialog.Title>

            <Spacing size={20} />

            <Box className="relative">
              <Image
                source={aidoBannerImage}
                resizeMode="contain"
                className="size-[84px] absolute top-[-58px] right-2"
              />
              <Controller
                control={control}
                name="message"
                render={({ field: { onChange, value } }) => (
                  <TextArea
                    autoFocus
                    isInvalid={!!errors.message}
                    label={`to. ${friend.displayName}`}
                    placeholder={`(선택) ${todo.title} 언제 할 거야?`}
                    value={value}
                    onChangeText={onChange}
                    className="min-h-[100px]"
                    errorMessage={errors?.message?.message}
                  />
                )}
              />
            </Box>

            <HStack gap={8} className="w-full" justify="center" mt={10}>
              <Button
                variant="weak"
                color="dark"
                size="large"
                display="inline"
                className="flex-1"
                onPress={() => handleOpenChange(false)}
              >
                취소
              </Button>
              <Button
                color="primary"
                size="large"
                display="inline"
                className="flex-1"
                onPress={handleSubmit(onSubmit)}
                isDisabled={!isValid}
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
