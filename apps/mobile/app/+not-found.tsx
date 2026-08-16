import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { DocsIcon, Result, StyledSafeAreaView } from '@src/shared/ui';
import { router } from 'expo-router';

export default function NotFoundScreen() {
  const goBack = useSingleTap(router.back);
  const replace = useSingleTap(router.replace);

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
                goBack();
              } else {
                replace('/feed');
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
