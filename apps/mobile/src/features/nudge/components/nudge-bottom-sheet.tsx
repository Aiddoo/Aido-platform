import aidoBannerImage from '@assets/images/aido_banner.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import { isBusinessError } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheetTextArea, Button, H4, KeyboardBottomSheet, Text, VStack } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useForm, useFormState } from 'react-hook-form';
import { Image, View } from 'react-native';

import { type NudgeFormInput, nudgeFormSchema } from '../domains/nudge-form.schema';
import { useSendRemindNudgeMutationOptions } from '../queries/use-send-remind-nudge-mutation-options';
import { useSendTodoNudgeMutationOptions } from '../queries/use-send-todo-nudge-mutation-options';

export interface NudgeReceiver {
  id: string;
  displayName: string;
}

export interface NudgeTargetTodo {
  id: number;
  title: string;
}

type SheetProps = Omit<ComponentProps<typeof KeyboardBottomSheet>, 'children'>;

/** 특정 할 일에 응원 메시지를 보내는 시트 */
export function NudgeBottomSheet({
  receiver,
  todo,
  ...sheetProps
}: SheetProps & { receiver: NudgeReceiver; todo: NudgeTargetTodo }) {
  const { t } = useTranslation('todo');
  const sendNudge = useMutation(useSendTodoNudgeMutationOptions());

  return (
    <NudgeMessageSheet
      {...sheetProps}
      receiver={receiver}
      caption={t('nudge.whenTodo', { title: todo.title })}
      placeholder={t('nudge.placeholder')}
      onSend={(message) =>
        sendNudge.mutateAsync({ receiverId: receiver.id, todoId: todo.id, message })
      }
    />
  );
}

/** 오늘 할 일이 없는 친구에게 독촉 메시지를 보내는 시트 */
export function RemindNudgeBottomSheet({
  receiver,
  ...sheetProps
}: SheetProps & { receiver: NudgeReceiver }) {
  const { t } = useTranslation('todo');
  const sendRemindNudge = useMutation(useSendRemindNudgeMutationOptions());

  return (
    <NudgeMessageSheet
      {...sheetProps}
      receiver={receiver}
      caption={t('nudge.remindTitle')}
      placeholder={t('nudge.remindPlaceholder')}
      onSend={(message) => sendRemindNudge.mutateAsync({ receiverId: receiver.id, message })}
    />
  );
}

interface NudgeMessageSheetProps extends SheetProps {
  receiver: NudgeReceiver;
  caption: string;
  placeholder: string;
  onSend: (message: string | undefined) => Promise<unknown>;
}

function NudgeMessageSheet({
  receiver,
  caption,
  placeholder,
  onSend,
  onOpenChange,
  ...sheetProps
}: NudgeMessageSheetProps) {
  const { showBoundary } = useErrorBoundary();
  const { t } = useTranslation('todo');
  const formMethods = useForm({
    resolver: zodResolver(nudgeFormSchema),
    defaultValues: { message: '' },
    mode: 'onChange',
  });
  const { control, handleSubmit, reset } = formMethods;
  const { isSubmitting, isValid } = useFormState({ control });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  const onSubmit = async ({ message }: NudgeFormInput) => {
    try {
      await onSend(message);
      handleOpenChange(false);
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  };

  return (
    <FormProvider {...formMethods}>
      <KeyboardBottomSheet {...sheetProps} onOpenChange={handleOpenChange}>
        <VStack gap={16} pb={16}>
          <VStack gap={2}>
            <Text size="b3" shade={6}>
              {caption}
            </Text>
            <H4>{t('nudge.sheetTitle')}</H4>
          </VStack>

          <View>
            <Image
              source={aidoBannerImage}
              className="absolute right-4 size-[72px] -translate-y-11"
              resizeMode="contain"
            />
            <FormField control={control} name="message">
              {({ onChange, value }, { error }) => (
                <BottomSheetTextArea
                  label={t('nudge.to', { name: receiver.displayName })}
                  isInvalid={!!error}
                  placeholder={placeholder}
                  value={value ?? ''}
                  onChange={onChange}
                  className="z-10 min-h-0 h-[80px]"
                  errorMessage={error?.message}
                />
              )}
            </FormField>
          </View>

          <Button
            color="primary"
            size="large"
            display="block"
            onPress={() => handleSubmit(onSubmit)()}
            isDisabled={!isValid}
            isLoading={isSubmitting}
          >
            {t('nudge.send')}
          </Button>
        </VStack>
      </KeyboardBottomSheet>
    </FormProvider>
  );
}
