import { USER_REPORT_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { formatCount } from '@src/shared/utils/format';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';
import {
  type Control,
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import { isReportTargetUnavailable } from '../domains/moderation.error';
import { useReportContentMutationOptions } from '../queries/moderation.mutations';
import {
  type UserReportFormInput,
  userReportFormSchema,
  type UserReportTarget,
  type UserReportTargetType,
} from '../schemas/user-report.schema';

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
  const { success } = useAppToast();
  const sheet = useSheetRoute('/feed');
  const reportContent = useMutation(useReportContentMutationOptions());
  const form = useForm({
    resolver: zodResolver(userReportFormSchema),
    defaultValues: { detail: '' },
    mode: 'onChange',
  });

  const handleReport = async (form: UserReportFormInput) => {
    try {
      await reportContent.mutateAsync({ target, form });
    } catch (error) {
      if (isReportTargetUnavailable(error)) {
        sheet.close();
      }
      return;
    }

    sheet.close();
    success(t('report.toast'), {
      description: t('report.toastDescription'),
      action: {
        label: t('report.toastBlockAction'),
        onPress: () =>
          router.push({
            pathname: '/users/[userId]/block',
            params: { userId: target.targetUserId, name: targetDisplayName },
          }),
      },
    });
  };

  return (
    <KeyboardBottomSheet
      {...sheetProps}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      footer={
        <SubmitButton control={form.control} onPress={() => form.handleSubmit(handleReport)()} />
      }
    >
      <FormProvider {...form}>
        <VStack gap={16} pb={16} testID="report-reason-sheet">
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
        </VStack>
      </FormProvider>
    </KeyboardBottomSheet>
  );
}

function ReasonField() {
  const { t } = useTranslation('moderation');
  const { control } = useFormContext<UserReportFormInput>();

  return (
    <Controller
      control={control}
      name="reason"
      render={({ field: { onChange, value } }) => (
        <RadioGroup value={value} onValueChange={onChange} className="gap-0 overflow-hidden">
          <IconRadioItem value="SPAM" label={t('report.reason.SPAM')} testID="report-reason-SPAM" />
          <IconRadioItem
            value="HARASSMENT"
            label={t('report.reason.HARASSMENT')}
            testID="report-reason-HARASSMENT"
          />
          <IconRadioItem
            value="INAPPROPRIATE"
            label={t('report.reason.INAPPROPRIATE')}
            testID="report-reason-INAPPROPRIATE"
          />
          <IconRadioItem
            value="IMPERSONATION"
            label={t('report.reason.IMPERSONATION')}
            testID="report-reason-IMPERSONATION"
          />
          <IconRadioItem
            value="OTHER"
            label={t('report.reason.OTHER')}
            testID="report-reason-OTHER"
          />
        </RadioGroup>
      )}
    />
  );
}

function DetailField() {
  const { t } = useTranslation('moderation');
  const { control } = useFormContext<UserReportFormInput>();

  return (
    <Controller
      control={control}
      name="detail"
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <BottomSheetTextArea
          label={t('report.detailLabel')}
          placeholder={t('report.detailPlaceholder')}
          value={value ?? ''}
          onChange={onChange}
          isInvalid={error != null}
          errorMessage={error?.message}
          maxLength={USER_REPORT_LIMITS.MAX_DETAIL_LENGTH}
          className="h-[88px] min-h-0"
          testID="report-detail-input"
        />
      )}
    />
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

interface SubmitButtonProps extends Pick<ComponentProps<typeof Button>, 'onPress'> {
  control: Control<UserReportFormInput>;
}

function SubmitButton({ control, onPress }: SubmitButtonProps) {
  const { t } = useTranslation('moderation');
  const reason = useWatch({ control, name: 'reason' });
  const { isSubmitting } = useFormState({ control });

  return (
    <Button
      color="primary"
      size="large"
      display="block"
      onPress={onPress}
      isDisabled={reason == null}
      isLoading={isSubmitting}
      testID="report-submit"
    >
      {t('report.submit')}
    </Button>
  );
}
