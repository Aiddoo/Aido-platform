import CheckIcon from '@assets/icons/ic_check.svg';
import MenuIcon from '@assets/icons/ic_menu.svg';
import PersonIcon from '@assets/icons/ic_person.svg';
import { Tabs } from 'expo-router';
import { useCSSVariable } from 'uniwind';

export default function AppLayout() {
  const borderColor = String(useCSSVariable('--gray-2'));
  const inactiveColor = String(useCSSVariable('--gray-5'));
  const activeColor = String(useCSSVariable('--main'));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: borderColor,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <CheckIcon width={24} height={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: '피드',
          tabBarIcon: ({ color }) => <MenuIcon width={24} height={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: '마이',
          tabBarIcon: ({ color }) => <PersonIcon width={24} height={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
