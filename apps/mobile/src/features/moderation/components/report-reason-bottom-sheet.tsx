import {
  type UserReportFormInput,
  type UserReportTargetType,
  USER_REPORT_LIMITS,
  userReportFormSchema,
} from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { TODO_SHEET_FALLBACK_HREF } from '@src/features/todo/utils/navigation/todo-sheet-href';
import { isApiError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheetTextArea,
  Button,
  H4,
  HStack,
  IconRadioItem,
  KeyboardBottomSheet,
  Text,
  VStack,
  useSheetRoute,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { formatCount } from '@src/shared/utils/format';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useForm, useFormContext, useFormState, useWatch } from 'react-hook-form';
import { match } from 'ts-pattern';

import { toReportFailureAction } from '../domains/moderation.error';
import type { UserReportTarget } from '../domains/user-report.model';
import { useReportContentMutationOptions } from '../queries/use-report-content-mutation-options';
import { blockUserConfirmHref } from '../utils/navigation/moderation-href';

const TARGET_CAPTION_KEYS = {
  PROFILE: 'report.caption.PROFILE',
  TODO: 'report.caption.TODO',
  COMMENT: 'report.caption.COMMENT',
  NUDGE_MESSAGE: 'report.caption.NUDGE_MESSAGE',
  CHEER_MESSAGE: 'report.caption.CHEER_MESSAGE',
} as const satisfies Record<UserReportTargetType, string>;

type ReportReasonBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
> & {
  target: UserReportTarget;
  /** 신고한 뒤 토스트의 차단 바로가기에서 확인 문구에 쓴다 */
  targetDisplayName: string;
};

/**
 * 신고 사유와 상세를 받아 신고한다. 신고하면 시트를 닫고 결과와 차단 바로가기를 토스트로 알린다.
 * 대상은 시트를 연 route가 정하고, 시트는 신고 폼과 mutation만 가진다.
 */
export function ReportReasonBottomSheet({
  target,
  targetDisplayName,
  ...sheetProps
}: ReportReasonBottomSheetProps) {
  const { t } = useTranslation('moderation');
  const { showBoundary } = useErrorBoundary();
  const { success, error: showErrorToast } = useAppToast();
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);
  const reportContent = useMutation(useReportContentMutationOptions());
  const formMethods = useForm<UserReportFormInput>({
    resolver: zodResolver(userReportFormSchema),
    defaultValues: { detail: '' },
    mode: 'onChange',
  });

  const handleReport = async (form: UserReportFormInput) => {
    try {
      await reportContent.mutateAsync({ target, form });
    } catch (reportError) {
      if (!isApiError(reportError)) {
        showBoundary(reportError);
        return;
      }
      showErrorToast(reportError.message);
      match(toReportFailureAction(reportError))
        .with('close', () => sheet.close())
        .with('stay', () => undefined)
        .exhaustive();
      return;
    }

    sheet.close();
    success(t('report.toast'), {
      description: t('report.toastDescription'),
      action: {
        label: t('report.toastBlockAction'),
        onPress: () =>
          router.push(
            blockUserConfirmHref({ userId: target.targetUserId, displayName: targetDisplayName }),
          ),
      },
    });
  };

  return (
    <FormProvider {...formMethods}>
      <KeyboardBottomSheet {...sheetProps} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
        <VStack gap={16} pb={16}>
          <VStack gap={2}>
            <Text size="b3" shade={7}>
              {t(TARGET_CAPTION_KEYS[target.targetType])}
            </Text>
            <H4>{t('report.title')}</H4>
          </VStack>

          <ReasonField />

          <VStack gap={6}>
            <DetailField />
            <DetailLengthCounter />
          </VStack>

          <Text size="e1" shade={7}>
            {t('report.notice')}
          </Text>

          <SubmitButton onPress={() => formMethods.handleSubmit(handleReport)()} />
        </VStack>
      </KeyboardBottomSheet>
    </FormProvider>
  );
}

function ReasonField() {
  const { t } = useTranslation('moderation');
  const { control } = useFormContext<UserReportFormInput>();

  return (
    <FormField control={control} name="reason">
      {({ onChange, value }) => (
        <RadioGroup value={value} onValueChange={onChange} className="gap-0 overflow-hidden">
          <IconRadioItem value="SPAM" label={t('report.reason.SPAM')} />
          <IconRadioItem value="HARASSMENT" label={t('report.reason.HARASSMENT')} />
          <IconRadioItem value="INAPPROPRIATE" label={t('report.reason.INAPPROPRIATE')} />
          <IconRadioItem value="IMPERSONATION" label={t('report.reason.IMPERSONATION')} />
          <IconRadioItem value="OTHER" label={t('report.reason.OTHER')} />
        </RadioGroup>
      )}
    </FormField>
  );
}

function DetailField() {
  const { t } = useTranslation('moderation');
  const { control } = useFormContext<UserReportFormInput>();

  return (
    <FormField control={control} name="detail">
      {({ onChange, value }, { error }) => (
        <BottomSheetTextArea
          label={t('report.detailLabel')}
          placeholder={t('report.detailPlaceholder')}
          value={value ?? ''}
          onChange={onChange}
          isInvalid={error != null}
          errorMessage={error?.message}
          maxLength={USER_REPORT_LIMITS.MAX_DETAIL_LENGTH}
          className="h-[88px] min-h-0"
        />
      )}
    </FormField>
  );
}

/** 상세 내용 길이만 구독해 글자를 칠 때 시트 전체가 다시 그려지지 않게 한다 */
function DetailLengthCounter() {
  const detail = useWatch<UserReportFormInput, 'detail'>({ name: 'detail' });
  const { locale } = useDateFormatContext();

  return (
    <HStack justify="end">
      <Text size="e1" weight="medium" shade={7} className="tabular-nums">
        {formatCount(detail?.length ?? 0, locale)}/
        {formatCount(USER_REPORT_LIMITS.MAX_DETAIL_LENGTH, locale)}
      </Text>
    </HStack>
  );
}

function SubmitButton({ onPress }: Pick<ComponentProps<typeof Button>, 'onPress'>) {
  const { t } = useTranslation('moderation');
  const reason = useWatch<UserReportFormInput, 'reason'>({ name: 'reason' });
  const { isSubmitting } = useFormState<UserReportFormInput>();

  return (
    <Button
      color="primary"
      size="large"
      display="block"
      onPress={onPress}
      isDisabled={reason == null}
      isLoading={isSubmitting}
    >
      {t('report.submit')}
    </Button>
  );
}
