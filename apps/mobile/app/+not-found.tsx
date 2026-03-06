import { DocsIcon, Result, StyledSafeAreaView } from '@src/shared/ui';
import { router } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title="페이지를 찾을 수 없어요"
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
            돌아가기
          </Result.Button>
        }
      />
    </StyledSafeAreaView>
  );
}
