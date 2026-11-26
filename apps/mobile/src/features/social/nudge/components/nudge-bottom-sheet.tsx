import { NUDGE_LIMITS } from '@aido/api/vocabulary';
import aidoBannerImage from '@assets/images/aido_banner.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  TextArea,
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
import { noop } from 'es-toolkit';
import type { ComponentProps } from 'react';
import { Controller, FormState, useForm } from 'react-hook-form';

import {
  useSendRemindNudgeMutationOptions,
  useSendTodoNudgeMutationOptions,
} from '../queries/todo-nudge.mutations';
import { nudgeFormSchema } from '../schemas/nudge-form.schema';
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

interface NudgeBottomSheetProps extends SheetProps {
  receiver: NudgeReceiver;
  todo: NudgeTargetTodo;
}

export function NudgeBottomSheet({ receiver, todo, ...sheetProps }: NudgeBottomSheetProps) {
  const { t } = useTranslation('todo');
  const haptics = useHaptics();
  const gate = useEntitlementGate('NUDGE', { surface: 'todo_nudge' });
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
      onSendFailed={(error) => {
        // 한도에 막힌 실패는 전역 토스트 대신 한도 안내를 띄운다. 그 밖의 안내는 mutation의 meta.errorFeedback이 한다
        if (gate.promptIfBlockedError(error)) {
          haptics.notify('error');
        }
      }}
    />
  );
}

interface RemindNudgeBottomSheetProps extends SheetProps {
  receiver: NudgeReceiver;
}

export function RemindNudgeBottomSheet({ receiver, ...sheetProps }: RemindNudgeBottomSheetProps) {
  const { t } = useTranslation('todo');
  const sendRemindNudge = useMutation(useSendRemindNudgeMutationOptions());

  return (
    <NudgeMessageSheet
      {...sheetProps}
      receiver={receiver}
      caption={t('nudge.remindTitle')}
      placeholder={t('nudge.remindPlaceholder')}
      onSend={(message) => sendRemindNudge.mutateAsync({ receiverId: receiver.id, message })}
      // 쿨다운 거절을 포함한 실패 안내는 mutation의 meta.errorFeedback이 한 번 한다
      onSendFailed={noop}
    />
  );
}

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
  /** 보내지 못했을 때. 시트와 적은 글은 그대로 남는다 */
  onSendFailed: (error: unknown) => void;
}

function NudgeMessageSheet({
  receiver,
  caption,
  placeholder,
  onSend,
  onSendFailed,
  onOpenChange,
  ...sheetProps
}: NudgeMessageSheetProps) {
  const { t } = useTranslation('todo');
  const form = useForm({
    resolver: zodResolver(nudgeFormSchema),
    defaultValues: { message: '' },
    mode: 'onChange',
  });

  // 시트는 닫히면 인스턴스가 사라져 적은 글을 따로 비우지 않는다
  const saveNudge = form.handleSubmit(async ({ message }) => {
    await onSend(message);
    onOpenChange(false);
  });
  // isSubmitting은 다음 렌더에야 켜져 같은 프레임의 두 번째 탭이 콕을 한 번 더 보낸다
  const handleSavePress = useSingleTap(() => {
    saveNudge().catch(onSendFailed);
  });

  return (
    <KeyboardBottomSheet
      {...sheetProps}
      onOpenChange={onOpenChange}
      footer={
        <FormState
          control={form.control}
          render={({ isSubmitting, isSubmitSuccessful, isValid }) => (
            <Button
              color="primary"
              size="large"
              display="block"
              onPress={handleSavePress}
              testID="nudge-send"
              isDisabled={!isValid}
              // 보내면 시트가 내려가는 동안에도 적은 글이 남는다. 그동안 다시 보내지 않는다
              isLoading={isSubmitting || isSubmitSuccessful}
            >
              {t('nudge.send')}
            </Button>
          )}
        />
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
              <TextArea
                ref={field.ref}
                label={t('nudge.to', { name: receiver.displayName })}
                isInvalid={fieldState.error != null}
                placeholder={placeholder}
                value={field.value ?? ''}
                onChange={field.onChange}
                className="z-10 h-[80px] min-h-0"
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
