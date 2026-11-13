import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useTranslation } from '@src/shared/i18n';
import { Result, SearchIllustration, StyledSafeAreaView } from '@src/shared/ui';

export default function NotFoundScreen() {
  const goBack = useGoBack({ fallbackHref: '/feed' });

  const { t } = useTranslation();

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <Result
        icon={<SearchIllustration />}
        title={t('notFound.title')}
        button={<Result.Button onPress={goBack}>{t('notFound.goBack')}</Result.Button>}
      />
    </StyledSafeAreaView>
  );
}
