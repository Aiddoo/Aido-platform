import 'expo-router/entry';
import { Platform } from 'react-native';

// Android 홈 위젯: 시스템 갱신 이벤트를 headless JS로 수신해 스냅샷을 렌더한다.
// iOS는 expo-widgets 경로를 쓰므로, Android 위젯 모듈 그래프가 iOS 콜드 스타트에
// 평가되지 않도록 가드 안에서 지연 require한다 (타입은 typeof import로 유지).
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } =
    require('react-native-android-widget') as typeof import('react-native-android-widget');
  const { widgetTaskHandler } =
    require('./src/features/widget/task-handler/widget-task-handler') as typeof import('./src/features/widget/task-handler/widget-task-handler');

  registerWidgetTaskHandler(widgetTaskHandler);
}
