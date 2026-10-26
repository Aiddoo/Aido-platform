import { useClipboard, useInviteService } from '@src/bootstrap/providers/di-context';
import { InviteCodeInput } from '@src/features/invite/components/invite-code-input';
import {
  type InvalidCharacterSummary,
  InviteCodePolicy,
  parseInviteCode,
  toInviteCodeDraft,
} from '@src/features/invite/domains/invite.model';
import { useInviteRouteParams } from '@src/features/invite/hooks/use-invite-route-params';
import { useTrackInviteLinkOpened } from '@src/features/invite/hooks/use-track-invite-link-opened';
import { useGetClipboardPresenceQueryOptions } from '@src/features/invite/queries/get-clipboard-presence-query-options';
import { getInvitePreviewQueryOptions } from '@src/features/invite/queries/get-invite-preview-query-options';
import { inviteCardHref } from '@src/features/invite/utils/navigation/invite-href';
import { useTrack } from '@src/shared/analytics';
import { isBusinessError } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  CopyIcon,
  FormField,
  H3,
  HStack,
  InfoIcon,
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { type InputOTPRef, PressableFeedback } from 'heroui-native';
import { type ComponentProps, useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { useForm, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';

interface InviteCodeForm {
  inviteCode: string;
}

function InviteCodeEntryScreen() {
  useTrackInviteLinkOpened();
  const { openedAt } = useInviteRouteParams();
  const { t } = useTranslation('invite');
  const { showBoundary } = useErrorBoundary();
  const { trackEvent } = useTrack();
  const inviteService = useInviteService();
  const queryClient = useQueryClient();
  const { control, handleSubmit, setValue, setError, clearErrors, formState } =
    useForm<InviteCodeForm>({ defaultValues: { inviteCode: '' } });
  const inviteCodeInputRef = useRef<InputOTPRef>(null);
  const draft = useWatch({ control, name: 'inviteCode' });
  const errorMessage = formState.errors.inviteCode?.message;
  // 오류는 값을 바꾸면 지워지므로, 오류가 있는 동안의 틀린 칸은 지금 값에서 다시 구해도 같다
  const invalidIndexes =
    errorMessage == null
      ? []
      : InviteCodePolicy.invalidCharacters(draft).map((invalidCharacter) => invalidCharacter.index);

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

  const submitInviteCode = handleSubmit(async ({ inviteCode: raw }) => {
    const inviteCode = parseInviteCode(raw);
    if (inviteCode == null) {
      const invalidCharacterSummary = InviteCodePolicy.invalidCharacterSummary(raw);
      setError('inviteCode', {
        message:
          invalidCharacterSummary == null
            ? t('errors.invalidCode')
            : formatInvalidCharacterMessage(invalidCharacterSummary),
      });
      // 키보드를 그대로 두어 바로 지우고 고쳐 쓰게 한다
      inviteCodeInputRef.current?.focus();
      return;
    }

    try {
      // 미리보기를 미리 받아 두면 초대 카드가 다시 부르지 않고, 없는 코드는 이 화면에서 바로 알린다
      await queryClient.fetchQuery(getInvitePreviewQueryOptions(inviteService, { inviteCode }));
      // 시스템 링크로 이 화면에 왔으면 착지할 때 이미 한 번 셌다. 앱 안에서 연 코드 입력만 여기서 센다
      if (openedAt == null) {
        trackEvent('invite_link_opened', { source: 'code_entry' });
      }
      router.replace(inviteCardHref(inviteCode, 'code_entry'));
    } catch (error) {
      // 4xx는 같은 화면에서 다시 입력하게 하고, 네트워크·서버 장애는 오류 경계가 맡는다
      if (!isBusinessError(error)) {
        showBoundary(error);
        return;
      }

      setError('inviteCode', { message: error.message });
    }
  });

  const handlePaste = (value: string) => {
    clearErrors('inviteCode');
    setValue('inviteCode', toInviteCodeDraft(value));
  };

  return (
    <Box flex={1} className="bg-white">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StyledSafeAreaView edges={['left', 'right']}>
          <ReadableContent px={24} pt={20}>
            <H3>{t('codeEntry.headline')}</H3>

            <Spacing size={10} />

            <Text size="b3" shade={7}>
              {t('codeEntry.description')}
            </Text>

            <Spacing size={32} />

            <FormField control={control} name="inviteCode">
              {({ value, onChange }) => (
                <InviteCodeInput
                  ref={inviteCodeInputRef}
                  value={value}
                  onChange={(next) => {
                    clearErrors('inviteCode');
                    onChange(next);
                  }}
                  // 틀린 글자가 있으면 그 칸만, 없는 코드처럼 전체가 틀렸으면 모든 칸을 빨갛게 그린다
                  isInvalid={errorMessage != null && invalidIndexes.length === 0}
                  invalidIndexes={invalidIndexes}
                  submitCount={formState.submitCount}
                  textInputProps={{
                    autoFocus: true,
                    returnKeyType: 'done',
                    // 틀렸을 때 바로 고쳐 쓰도록 제출해도 키보드를 내리지 않는다
                    submitBehavior: 'submit',
                    onSubmitEditing: () => {
                      if (InviteCodePolicy.isFilled(draft)) {
                        submitInviteCode();
                      }
                    },
                    accessibilityLabel: t('codeEntry.inputLabel'),
                  }}
                  testID="invite-code-input"
                />
              )}
            </FormField>

            <Spacing size={12} />

            {errorMessage == null ? (
              <PasteInviteCodeChip onChange={handlePaste} />
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
        isDisabled={!InviteCodePolicy.isFilled(draft)}
        isLoading={formState.isSubmitting}
      >
        {errorMessage == null ? t('codeEntry.submit') : t('codeEntry.retry')}
      </KeyboardAdaptiveButton>
    </Box>
  );
}

interface PasteInviteCodeChipProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'onPress' | 'children'
> {
  onChange: (value: string) => void;
}

/**
 * 클립보드에 글자가 있는지만 보고 칩을 보여 준다. 실제로 읽는 건 누를 때라
 * iOS 붙여넣기 허용 배너가 화면에 들어오자마자 뜨지 않는다.
 */
function PasteInviteCodeChip({ onChange, ...props }: PasteInviteCodeChipProps) {
  const clipboard = useClipboard();
  const [hasPasted, setHasPasted] = useState(false);
  const { data: hasClipboardText } = useQuery({
    ...useGetClipboardPresenceQueryOptions(),
    throwOnError: false,
  });

  const handlePaste = async () => {
    const text = await clipboard.getString();
    setHasPasted(true);
    onChange(text);
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

/** 확인 중 예상하지 못한 오류는 이 화면 안에서 받아 다시 시도하게 한다 */
export default function InviteCodeEntryRoute() {
  return (
    <QueryErrorBoundary>
      <InviteCodeEntryScreen />
    </QueryErrorBoundary>
  );
}
