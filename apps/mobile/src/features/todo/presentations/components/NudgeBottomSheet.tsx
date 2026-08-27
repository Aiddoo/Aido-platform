import aidoBannerImage from '@assets/images/aido_banner.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheetTextArea, Button, H4, KeyboardBottomSheet, Text, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, View } from 'react-native';

import { useSendTodoNudgeMutationOptions } from '../queries/use-send-todo-nudge-mutation-options';
import { type NudgeFormInput, nudgeFormSchema } from '../schemas/nudge-form.schema';

export interface NudgeReceiver {
  id: string;
  displayName: string;
}

export interface NudgeTargetTodo {
  id: number;
  title: string;
}

interface NudgeBottomSheetProps extends Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children'
> {
  receiver: NudgeReceiver;
  todo: NudgeTargetTodo;
}

export function NudgeBottomSheet({
  receiver,
  todo,
  isOpen,
  onOpenChange,
  ...bottomSheetProps
}: NudgeBottomSheetProps) {
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
        receiverId: receiver.id,
        todoId: todo.id,
        message: data.message,
      },
      {
        onSuccess: () => handleOpenChange(false),
      },
    );
  };

  return (
    <KeyboardBottomSheet {...bottomSheetProps} isOpen={isOpen} onOpenChange={handleOpenChange}>
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
                label={`to. ${receiver.displayName}`}
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
