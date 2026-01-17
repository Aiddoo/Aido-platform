import { BottomSheet, Button } from 'heroui-native';
import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 px-6">
      <Text className="mb-6 text-base text-gray-700">홈 페이지</Text>

      <BottomSheet>
        <BottomSheet.Trigger asChild>
          <Button variant="primary">
            <Button.Label>바텀시트 열기</Button.Label>
          </Button>
        </BottomSheet.Trigger>

        <BottomSheet.Portal>
          <BottomSheet.Overlay className="bg-black/40" />
          <BottomSheet.Content className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
            <BottomSheet.Title className="text-lg font-semibold text-gray-900">
              HeroUI 바텀시트
            </BottomSheet.Title>
            <BottomSheet.Description className="mt-2 text-sm text-gray-600">
              버튼을 눌러서 열렸어요.
            </BottomSheet.Description>
            <BottomSheet.Close asChild>
              <Button className="mt-6">
                <Button.Label>닫기</Button.Label>
              </Button>
            </BottomSheet.Close>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}
