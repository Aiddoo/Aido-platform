import { INVITE_CODE } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { InviteCodeInput } from '@src/features/social/invite/components/invite-code-input';
import {
  findInviteCodeFieldError,
  INVITE_CODE_SERVER_ERROR_TYPE,
} from '@src/features/social/invite/domains/invite.error';
import {
  useTrackInviteCodeEntryOpened,
  useTrackInviteLinkOpened,
} from '@src/features/social/invite/hooks/use-track-invite-link-opened';
import { useCheckInvitePreviewMutationOptions } from '@src/features/social/invite/queries/invite.mutations';
import { inviteCodeFormSchema } from '@src/features/social/invite/schemas/invite-code-form.schema';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FormScrollView,
  H3,
  KeyboardAdaptiveButton,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { useNavigation, useRouter } from 'expo-router';
import { Controller, FormState, useForm } from 'react-hook-form';

export default function InviteCodeEntryScreen() {
  const { t } = useTranslation('invite');
  const trackCodeEntryOpened = useTrackInviteCodeEntryOpened();
  const router = useRouter();
  const navigation = useNavigation();
  const checkPreview = useMutation(useCheckInvitePreviewMutationOptions());
  // 코드에 없는 글자는 적는 즉시 알린다. 서버가 거절한 코드의 오류는 값을 바꾸면 다시 검사하며 지워진다
  const form = useForm({
    resolver: zodResolver(inviteCodeFormSchema),
    defaultValues: { inviteCode: '' },
    mode: 'onChange',
  });

  useTrackInviteLinkOpened();

  // 형식이 틀리면 RHF가 코드 칸에 포커스해 키보드를 그대로 둔다. 확인하지 못한 제출은 던져야 다시 누를 수 있다
  const saveInviteCode = form.handleSubmit(async ({ inviteCode }) => {
    // 미리보기를 미리 받아 두면 초대 카드가 다시 부르지 않고, 없는 코드는 이 화면에서 바로 알린다
    await checkPreview.mutateAsync(inviteCode);
    // 조회하는 사이 화면을 떠났으면 지금 보이는 다른 화면을 바꾸지 않고, 돌아와 다시 확인할 수 있게 코드는 둔 채 폼을 연다
    if (!navigation.isFocused()) {
      form.reset({ inviteCode });
      return;
    }
    trackCodeEntryOpened();
    router.replace({
      pathname: '/invite/[inviteCode]',
      params: { inviteCode, source: 'code_entry' },
    });
  });
  // 같은 프레임의 두 번째 탭은 isSubmitting이 다음 렌더에야 켜져 여기서 막는다
  const handleSavePress = useSingleTap(() => {
    saveInviteCode().catch((error: unknown) => {
      // 4xx는 같은 화면에서 다시 입력하게 코드 칸에 보인다. 네트워크·서버 장애는 전역 토스트가 알리고 입력한 코드는 둔다
      const fieldError = findInviteCodeFieldError(error);
      if (fieldError != null) {
        form.setError('inviteCode', fieldError);
      }
    });
  });

  return (
    <Box flex={1} className="bg-white">
      <FormScrollView
        contentInsetAdjustmentBehavior="automatic"
        footer={
          <FormState
            control={form.control}
            render={({ errors, isSubmitting, isSubmitSuccessful, isValid }) => (
              <KeyboardAdaptiveButton
                testID="invite-code-submit"
                onPress={handleSavePress}
                isDisabled={!isValid}
                // 확인하면 초대 카드로 바뀌는 동안에도 같은 코드가 남는다. 그동안 다시 확인하지 않는다
                isLoading={isSubmitting || isSubmitSuccessful}
              >
                {errors.inviteCode?.type === INVITE_CODE_SERVER_ERROR_TYPE
                  ? t('codeEntry.retry')
                  : t('codeEntry.submit')}
              </KeyboardAdaptiveButton>
            )}
          />
        }
      >
        <StyledSafeAreaView edges={['left', 'right']}>
          <ReadableContent px={24} pt={20}>
            <H3>{t('codeEntry.headline')}</H3>

            <Spacing size={8} />

            <Text size="b3" shade={7}>
              {t('codeEntry.description', { count: INVITE_CODE.LENGTH })}
            </Text>

            <Spacing size={32} />

            <Controller
              control={form.control}
              name="inviteCode"
              render={({
                field: { ref, value, onChange },
                fieldState: { error },
                formState: { isSubmitting, isSubmitSuccessful, submitCount },
              }) => (
                <InviteCodeInput
                  ref={ref}
                  value={value}
                  onChange={onChange}
                  error={error}
                  submitCount={submitCount}
                  textInputProps={{
                    autoFocus: true,
                    returnKeyType: 'done',
                    // 틀렸을 때 바로 고쳐 쓰도록 제출해도 키보드를 내리지 않는다
                    submitBehavior: 'submit',
                    onSubmitEditing: () => {
                      if (!isSubmitting && !isSubmitSuccessful) {
                        handleSavePress();
                      }
                    },
                    accessibilityLabel: t('codeEntry.inputLabel'),
                  }}
                  testID="invite-code-input"
                />
              )}
            />
          </ReadableContent>
        </StyledSafeAreaView>
      </FormScrollView>
    </Box>
  );
}
