/** 네이티브 버튼 아이콘 한 쌍. iOS는 SF Symbol 이름, Android는 `@expo/material-symbols/{name}.xml`이다 */
interface NativeIconPair<SfSymbol extends string | undefined, MaterialSymbol> {
  ios: SfSymbol;
  android: MaterialSymbol;
}

/**
 * 네이티브 헤더·메뉴 아이콘을 플랫폼으로 고른다. iOS가 라벨만 그리는 글자 버튼은 `ios: undefined`로 Android에만 아이콘을 준다.
 * `EXPO_OS`는 빌드 때 정해져 앱이 도는 동안 바뀌지 않아 모듈 상수로 만든다
 */
export function nativeIcon<SfSymbol extends string | undefined, MaterialSymbol>({
  ios,
  android,
}: NativeIconPair<SfSymbol, MaterialSymbol>): SfSymbol | MaterialSymbol {
  return process.env.EXPO_OS === 'ios' ? ios : android;
}
