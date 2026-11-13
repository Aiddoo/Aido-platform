# OfflineBanner

기기가 오프라인일 때 화면 맨 위에 한 줄로 알리는 배너입니다. 앱 루트(`AppProviders`)에 한 번만 둡니다.

## 사용법

```tsx
import { OfflineBanner } from '@src/shared/ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';

<OfflineBanner />
<SafeAreaProvider style={{ flex: 1 }}>{children}</SafeAreaProvider>
```

- 연결 상태는 `useIsOnline()`(React Query `onlineManager`)에서 읽습니다. 연결 감지는 `OnlineManagerProvider`가
  `NetworkStatusGateway`(expo-network)를 `onlineManager`에 연결해 한 곳에서 합니다. 화면마다 상태를 두지 않습니다.
- 배너는 위·좌·우 safe area를 스스로 채웁니다. 아래 내용은 별도 `SafeAreaProvider`로 감싸 상태 표시줄 inset을
  두 번 받지 않게 합니다(네이티브 헤더·Duo 레일과 겹치지 않음).
- 나타날 때 스크린 리더에 문구를 알립니다. 들어오고 나가는 페이드는 동작 줄이기 설정을 따릅니다.
- 오프라인 동안 쿼리는 멈춰 로딩·캐시를 보이고, 다시 연결되면 React Query가 이어서 불러옵니다.

## Props

없음.
