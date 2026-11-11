import { useTrack } from '@src/shared/analytics';
import { getUserFacingMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import {
  FormScrollView,
  HStack,
  InfoIcon,
  KeyboardAdaptiveButton,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { onlineManager, useMutation } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import type { InputOTPRef } from 'heroui-native';
import { type PropsWithChildren, useRef } from 'react';
import { Controller, useForm, useFormState, useWatch } from 'react-hook-form';

import { InviteCodePolicy } from '../domains/invite-code.model';
import { isInviteCodeFieldError } from '../domains/invite.error';
import { useInviteParams } from '../hooks/use-invite-params';
import { useCheckInvitePreviewMutationOptions } from '../queries/invite.mutations';
import {
  type InvalidCharacterSummary,
  summarizeInvalidCharacters,
} from '../utils/invite-code.view-model';
import { InviteCodeInput } from './invite-code-input';

/** 코드 입력과 제출 버튼. 입력 위에 붙는 안내는 화면이 children으로 넘긴다 */
export function InviteCodeEntryForm({ children }: PropsWithChildren) {
  const [{ openedAt }] = useInviteParams();
  const { t } = useTranslation('invite');
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const checkPreview = useMutation(useCheckInvitePreviewMutationOptions());
  const navigation = useNavigation();
  const form = useForm({ defaultValues: { inviteCode: '' } });
  const { errors, submitCount, isSubmitting } = useFormState({ control: form.control });
  const inviteCodeInputRef = useRef<InputOTPRef>(null);
  const draft = useWatch({ control: form.control, name: 'inviteCode' });
  const errorMessage = errors.inviteCode?.message;
  // 오류는 값을 바꾸면 지워지므로, 오류가 있는 동안의 틀린 칸은 지금 값에서 다시 구해도 같다
  const invalidIndexes =
    errorMessage == null
      ? []
      : InviteCodePolicy.findInvalidCharacters(draft).map(
          (invalidCharacter) => invalidCharacter.index,
        );

  const formatInvalidCharacterMessage = ({
    kind,
    listedCharacters,
    uniqueCount,
  }: InvalidCharacterSummary) => {
    const quotedCharacters = listedCharacters.map((character) => `‘${character}’`).join(', ');
    const characters =
      uniqueCount > listedCharacters.length
        ? t('codeEntry.invalidCharacter.more', { characters: quotedCharacters })
        : quotedCharacters;

    return kind === 'confusable'
      ? t('codeEntry.invalidCharacter.confusable', { characters, count: uniqueCount })
      : t('codeEntry.invalidCharacter.unused', { characters, count: uniqueCount });
  };

  const submitInviteCode = () =>
    form.handleSubmit(async ({ inviteCode: raw }) => {
      const inviteCode = InviteCodePolicy.parseInviteCode(raw);
      if (inviteCode == null) {
        const invalidCharacterSummary = summarizeInvalidCharacters(
          InviteCodePolicy.findInvalidCharacters(raw),
        );
        form.setError('inviteCode', {
          message:
            invalidCharacterSummary == null
              ? t('errors.invalidCode')
              : formatInvalidCharacterMessage(invalidCharacterSummary),
        });
        // 키보드를 그대로 두어 바로 지우고 고쳐 쓰게 한다
        inviteCodeInputRef.current?.focus();
        return;
      }

      // 오프라인이면 조회가 연결될 때까지 멈춰 버튼이 돌기만 한다. 입력한 코드를 둔 채 바로 알린다
      if (!onlineManager.isOnline()) {
        toast.warning(t('errors.offline'));
        return;
      }

      try {
        // 미리보기를 미리 받아 두면 초대 카드가 다시 부르지 않고, 없는 코드는 이 화면에서 바로 알린다
        await checkPreview.mutateAsync(inviteCode);
        // 조회하는 사이 화면을 떠났으면 지금 보이는 다른 화면을 바꾸지 않는다
        if (!navigation.isFocused()) {
          return;
        }
        // 시스템 링크로 이 화면에 왔으면 착지할 때 이미 한 번 셌다. 앱 안에서 연 코드 입력만 여기서 센다
        if (openedAt == null) {
          trackEvent('invite_link_opened', { source: 'code_entry' });
        }
        router.replace({
          pathname: '/invite/[inviteCode]',
          params: { inviteCode, source: 'code_entry' },
        });
      } catch (error) {
        // 4xx는 같은 화면에서 다시 입력하게 코드 칸에 보인다. 네트워크·서버 장애는 전역 토스트가 알리고 입력한 코드는 둔다
        if (isInviteCodeFieldError(error)) {
          form.setError('inviteCode', {
            message: getUserFacingMessage(error) ?? t('errors.invalidCode'),
          });
        }
      }
    })();

  return (
    <FormScrollView
      contentInsetAdjustmentBehavior="automatic"
      footer={
        <KeyboardAdaptiveButton
          testID="invite-code-submit"
          onPress={() => submitInviteCode()}
          isDisabled={!InviteCodePolicy.isFilledInviteCode(draft)}
          isLoading={isSubmitting}
        >
          {errorMessage == null ? t('codeEntry.submit') : t('codeEntry.retry')}
        </KeyboardAdaptiveButton>
      }
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        <ReadableContent px={24} pt={20}>
          {children}

          <Controller
            control={form.control}
            name="inviteCode"
            render={({ field: { value, onChange } }) => (
              <InviteCodeInput
                ref={inviteCodeInputRef}
                value={value}
                onChange={(next) => {
                  form.clearErrors('inviteCode');
                  onChange(next);
                }}
                // 틀린 글자가 있으면 그 칸만, 없는 코드처럼 전체가 틀렸으면 모든 칸을 빨갛게 그린다
                isInvalid={errorMessage != null && invalidIndexes.length === 0}
                invalidIndexes={invalidIndexes}
                submitCount={submitCount}
                textInputProps={{
                  autoFocus: true,
                  returnKeyType: 'done',
                  // 틀렸을 때 바로 고쳐 쓰도록 제출해도 키보드를 내리지 않는다
                  submitBehavior: 'submit',
                  onSubmitEditing: () => {
                    if (InviteCodePolicy.isFilledInviteCode(draft) && !isSubmitting) {
                      submitInviteCode();
                    }
                  },
                  accessibilityLabel: t('codeEntry.inputLabel'),
                }}
                testID="invite-code-input"
              />
            )}
          />

          {errorMessage != null && (
            <>
              <Spacing size={12} />
              <HStack
                gap={6}
                align="center"
                accessibilityRole="alert"
                testID="invite-code-error"
                accessibilityLiveRegion="polite"
              >
                <InfoIcon width={16} height={16} colorClassName="text-error" />
                <Text
                  size="b4"
                  weight="semibold"
                  tone="danger"
                  lineBreakStrategyIOS="hangul-word"
                  className="flex-1"
                >
                  {errorMessage}
                </Text>
              </HStack>
            </>
          )}
        </ReadableContent>
      </StyledSafeAreaView>
    </FormScrollView>
  );
}
