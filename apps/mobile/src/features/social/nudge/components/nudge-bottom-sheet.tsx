import { NUDGE_LIMITS } from '@aido/api/vocabulary';
import aidoBannerImage from '@assets/images/aido_banner.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheetTextArea,
  Button,
  H4,
  KeyboardBottomSheet,
  Text,
  VStack,
  Box,
  useSheetRoute,
  Image,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';

import {
  useSendRemindNudgeMutationOptions,
  useSendTodoNudgeMutationOptions,
} from '../queries/todo-nudge.mutations';
import { type NudgeFormValues, nudgeFormSchema } from '../schemas/nudge-form.schema';
import { remindNudgeParamsSchema } from '../schemas/nudge-params.schema';

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

/** route(`/users/[userId]/nudge`)로 띄운 독촉 콕 시트. 받는 사람은 route에서 읽는다 */
RemindNudgeBottomSheet.Route = function Route() {
  const [{ userId, name }] = useRouteParams(remindNudgeParamsSchema);
  const sheet = useSheetRoute('/feed');

  return (
    <RemindNudgeBottomSheet
      receiver={{ id: userId, displayName: name }}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
    />
  );
};

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
  const { t } = useTranslation('todo');
  const form = useForm({
    resolver: zodResolver(nudgeFormSchema),
    defaultValues: { message: '' },
    mode: 'onChange',
  });
  const { isSubmitting, isValid } = useFormState({ control: form.control });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  const handleSubmitNudge = async ({ message }: NudgeFormValues) => {
    try {
      await onSend(message);
      handleOpenChange(false);
    } catch {
      // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
    }
  };

  // isSubmitting은 다음 렌더에야 켜져 같은 프레임의 두 번째 탭이 콕을 한 번 더 보낸다
  const submitNudge = useSingleTap(() => form.handleSubmit(handleSubmitNudge)());

  return (
    <KeyboardBottomSheet
      {...sheetProps}
      onOpenChange={handleOpenChange}
      footer={
        <Button
          color="primary"
          size="large"
          display="block"
          onPress={submitNudge}
          isDisabled={!isValid}
          isLoading={isSubmitting}
        >
          {t('nudge.send')}
        </Button>
      }
    >
      <VStack gap={16}>
        <VStack gap={2}>
          <Text size="b3" shade={6}>
            {caption}
          </Text>
          <H4>{t('nudge.sheetTitle')}</H4>
        </VStack>

        <Box>
          <Image
            source={aidoBannerImage}
            className="absolute right-4 size-[72px] -translate-y-11"
            contentFit="contain"
          />
          <Controller
            control={form.control}
            name="message"
            render={({ field, fieldState }) => (
              <BottomSheetTextArea
                ref={field.ref}
                label={t('nudge.to', { name: receiver.displayName })}
                isInvalid={fieldState.error != null}
                placeholder={placeholder}
                value={field.value ?? ''}
                onChange={field.onChange}
                className="z-10 min-h-0 h-[80px]"
                errorMessage={
                  fieldState.error == null
                    ? undefined
                    : t('form.nudgeMessageMax', { count: NUDGE_LIMITS.MAX_MESSAGE_LENGTH })
                }
              />
            )}
          />
        </Box>
      </VStack>
    </KeyboardBottomSheet>
  );
}
