import { createRuleTester } from '../rule-tester.mjs';
import rules from './platform.mjs';

const tester = createRuleTester();

tester.run('no-system-bar-color', rules['no-system-bar-color'], {
  valid: [
    '<StatusBar style="dark" hidden={false} />',
    'StatusBar.setBarStyle("dark-content");',
    '<View backgroundColor="white" />',
    "<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'white' } }} />",
    "import { setStyle } from 'expo-navigation-bar';",
    "import * as NavigationBar from 'expo-navigation-bar';\nNavigationBar.setVisibilityAsync('hidden');",
    "const config = { android: { adaptiveIcon: { backgroundColor: '#FF6843' } }, splash: { backgroundColor: '#FF6843' } };",
  ],
  invalid: [
    { code: '<StatusBar backgroundColor="white" translucent />', errors: 2 },
    { code: '<RN.StatusBar translucent={false} />', errors: 1 },
    { code: "StatusBar.setBackgroundColor('white');", errors: 1 },
    { code: 'StatusBar.setTranslucent(true);', errors: 1 },
    {
      code: "import { setBackgroundColorAsync, setBorderColorAsync } from 'expo-navigation-bar';",
      errors: 2,
    },
    {
      code: "import * as NavigationBar from 'expo-navigation-bar';\nNavigationBar.setBackgroundColorAsync('white');",
      errors: 1,
    },
    { code: "import { setStatusBarBackgroundColor } from 'expo-status-bar';", errors: 1 },
    {
      code: "<Stack.Screen options={{ statusBarColor: 'white', navigationBarColor: 'white' }} />",
      errors: 2,
    },
    {
      code: '<Stack screenOptions={{ statusBarTranslucent: true, navigationBarTranslucent: true }} />',
      errors: 2,
    },
    { code: '<Screen statusBarBackgroundColor="white" />', errors: 1 },
    {
      code: "const config = { androidStatusBar: { backgroundColor: '#fff', translucent: true }, androidNavigationBar: { backgroundColor: '#fff' } };",
      errors: 3,
    },
  ],
});
