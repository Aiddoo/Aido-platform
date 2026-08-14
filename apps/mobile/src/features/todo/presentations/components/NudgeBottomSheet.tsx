import aidoBannerImage from '@assets/images/aido_banner.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FriendUserViewModel } from '@src/features/friend/presentations/view-models/friend-user.view-model';
import type { TodoItem } from '@src/features/todo/models/todo.model';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheetTextArea, Button, H4, KeyboardBottomSheet, Text, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Image, View } from 'react-native';

import { useSendTodoNudgeMutationOptions } from '../queries/use-send-todo-nudge-mutation-options';
import { type NudgeFormInput, nudgeFormSchema } from '../schemas/nudge-form.schema';

interface NudgeBottomSheetProps {
  friend: FriendUserViewModel;
  todo: TodoItem;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function NudgeBottomSheet({ friend, todo, isOpen, onOpenChange }: NudgeBottomSheetProps) {
  const { t } = useTranslation('todo');
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

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  const onSubmit = (data: NudgeFormInput) => {
    sendNudgeMutation.mutate(
      {
        receiverId: friend.id,
        todoId: todo.id,
        message: data.message,
      },
      {
        onSuccess: () => handleOpenChange(false),
      },
    );
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <VStack gap={16} pb={16}>
        <VStack gap={4}>
          <VStack gap={2}>
            <Text size="b3" shade={6}>
              {t('nudge.whenTodo', { title: todo.title })}
            </Text>
            <H4>{t('nudge.sheetTitle')}</H4>
          </VStack>
        </VStack>

        <View>
          <Image
            source={aidoBannerImage}
            className="absolute right-4 size-[72px] -translate-y-11"
            resizeMode="contain"
          />
          <Controller
            control={control}
            name="message"
            render={({ field: { onChange, value } }) => (
              <BottomSheetTextArea
                label={`to. ${friend.displayName}`}
                isInvalid={!!errors.message}
                placeholder={t('nudge.placeholder')}
                value={value}
                onChangeText={onChange}
                className="z-10 min-h-0 h-[80px]"
                errorMessage={errors?.message?.message}
              />
            )}
          />
        </View>

        <Button
          color="primary"
          size="large"
          display="block"
          onPress={handleSubmit(onSubmit)}
          isDisabled={!isValid}
          isLoading={sendNudgeMutation.isPending}
        >
          {t('nudge.send')}
        </Button>
      </VStack>
    </KeyboardBottomSheet>
  );
}
