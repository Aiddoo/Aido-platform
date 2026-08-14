import aidoBannerImage from '@assets/images/aido_banner.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FriendUserViewModel } from '@src/features/friend/presentations/view-models/friend-user.view-model';
import type { TodoItem } from '@src/features/todo/models/todo.model';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, H4, HStack, Spacing, Text, TextArea, VStack } from '@src/shared/ui';
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
  const { t } = useTranslation(['todo', 'common']);
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
                  {t('nudge.dialogTarget', { name: friend.displayName })}
                </Text>
                <H4>{t('nudge.sheetTitle')}</H4>
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
                    placeholder={t('nudge.dialogPlaceholder', { title: todo.title })}
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
                {t('common:actions.cancel')}
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
                {t('nudge.send')}
              </Button>
            </HStack>
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
