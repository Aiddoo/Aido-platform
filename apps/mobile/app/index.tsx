import { StyleSheet, Text, View } from 'react-native';

// TODO: Hero UI 설치
// https://v3.heroui.com/docs/native/getting-started (고민 중)
// 더 좋은게 있으면 대안을 찾아보자!
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>홈 페이지</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
