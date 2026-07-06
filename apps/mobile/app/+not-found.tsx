import { useTranslation } from '@src/shared/i18n';
import { DocsIcon, Result, StyledSafeAreaView } from '@src/shared/ui';
import { router } from 'expo-router';

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('notFound.title')}
        button={
          <Result.Button
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/feed');
              }
            }}
          >
            {t('notFound.goBack')}
          </Result.Button>
        }
      />
    </StyledSafeAreaView>
  );
}
