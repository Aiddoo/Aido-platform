import { useClipboard, useInviteService } from '@src/bootstrap/providers/di-context';
import { InviteCodeInput } from '@src/features/social/invite/components/invite-code-input';
import {
  type InvalidCharacterSummary,
  InviteCodePolicy,
  summarizeInvalidCharacters,
  parseInviteCode,
  toInviteCodeDraft,
} from '@src/features/social/invite/domains/invite.model';
import { useInviteRouteParams } from '@src/features/social/invite/hooks/use-invite-route-params';
import { useGetClipboardPresenceQueryOptions } from '@src/features/social/invite/queries/invite.queries';
import { getInvitePreviewQueryOptions } from '@src/features/social/invite/queries/invite.queries';
import { useTrack } from '@src/shared/analytics';
import { isBusinessError } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  CopyIcon,
  HStack,
  InfoIcon,
  KeyboardAdaptiveButton,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { type InputOTPRef, PressableFeedback } from 'heroui-native';
import { type ComponentProps, type PropsWithChildren, useRef, useState } from 'react';
import { Controller, useForm, useFormState, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';

/** 코드 입력과 제출 버튼. 입력 위에 붙는 안내는 화면이 children으로 넘긴다 */
export function InviteCodeEntryForm({ children }: PropsWithChildren) {
  const { openedAt } = useInviteRouteParams();
  const { t } = useTranslation('invite');
  const showFailure = useMutationFailure();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const inviteService = useInviteService();
  const queryClient = useQueryClient();
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

  const submitInviteCode = form.handleSubmit(async ({ inviteCode: raw }) => {
    const inviteCode = parseInviteCode(raw);
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
      await queryClient.fetchQuery({
        ...getInvitePreviewQueryOptions(inviteService, { inviteCode }),
        // 보내는 사이 연결이 끊겨도 멈추지 않고 실패해 토스트로 알린다
        networkMode: 'always',
      });
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
      // 4xx는 같은 화면에서 다시 입력하게 하고, 네트워크·서버 장애는 토스트로 알려 입력한 코드를 지키지 않고 둔다
      if (!isBusinessError(error)) {
        showFailure(error);
        return;
      }

      form.setError('inviteCode', { message: error.message });
    }
  });

  const handlePaste = (value: string) => {
    form.clearErrors('inviteCode');
    form.setValue('inviteCode', toInviteCodeDraft(value));
  };

  return (
    <>
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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
                      if (InviteCodePolicy.isFilledInviteCode(draft)) {
                        submitInviteCode();
                      }
                    },
                    accessibilityLabel: t('codeEntry.inputLabel'),
                  }}
                  testID="invite-code-input"
                />
              )}
            />

            <Spacing size={12} />

            {errorMessage == null ? (
              <PasteInviteCodeChip onPaste={handlePaste} />
            ) : (
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
            )}
          </ReadableContent>
        </StyledSafeAreaView>
      </ScrollView>

      <KeyboardAdaptiveButton
        testID="invite-code-submit"
        onPress={() => submitInviteCode()}
        isDisabled={!InviteCodePolicy.isFilledInviteCode(draft)}
        isLoading={isSubmitting}
      >
        {errorMessage == null ? t('codeEntry.submit') : t('codeEntry.retry')}
      </KeyboardAdaptiveButton>
    </>
  );
}

interface PasteInviteCodeChipProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'onPress' | 'children'
> {
  onPaste: (value: string) => void;
}

/**
 * 클립보드에 글자가 있는지만 보고 칩을 보여 준다. 실제로 읽는 건 누를 때라
 * iOS 붙여넣기 허용 배너가 화면에 들어오자마자 뜨지 않는다.
 */
function PasteInviteCodeChip({ onPaste, ...props }: PasteInviteCodeChipProps) {
  const clipboard = useClipboard();
  const [hasPasted, setHasPasted] = useState(false);
  const { data: hasClipboardText } = useQuery({
    ...useGetClipboardPresenceQueryOptions(),
    throwOnError: false,
  });

  const handlePaste = async () => {
    const text = await clipboard.paste();
    setHasPasted(true);
    onPaste(text);
  };

  // 칩이 없어도 같은 모양을 보이지 않게 그려 글자 크기와 상관없이 오류 문구로 바뀔 때 버튼이 밀리지 않는다
  if (hasClipboardText !== true || hasPasted) {
    return (
      <Box
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        className="self-start rounded-full px-3.5 py-2 opacity-0"
      >
        <PasteInviteCodeLabel />
      </Box>
    );
  }

  return (
    <PressableFeedback
      accessibilityRole="button"
      testID="invite-code-paste"
      onPress={() => handlePaste().catch(() => setHasPasted(true))}
      className="self-start rounded-full bg-main/10 px-3.5 py-2"
      {...props}
    >
      <PasteInviteCodeLabel />
    </PressableFeedback>
  );
}

function PasteInviteCodeLabel() {
  const { t } = useTranslation('invite');

  return (
    <HStack gap={6} align="center">
      <CopyIcon width={16} height={16} colorClassName="text-main" />
      <Text size="b4" weight="semibold" tone="brand">
        {t('codeEntry.paste')}
      </Text>
    </HStack>
  );
}
