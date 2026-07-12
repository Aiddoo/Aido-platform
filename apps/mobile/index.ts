import 'expo-router/entry';

import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './src/features/widget/task-handler/widget-task-handler';

// Android 홈 위젯: 시스템 갱신/클릭 이벤트를 headless JS로 수신해 스냅샷을 렌더한다.
// 위젯 렌더는 앱 트리 밖(headless)에서 실행되므로 expo-router 엔트리와 별도로 등록한다.
if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
}
