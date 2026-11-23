import { StyleSheet } from 'react-native';

export const SHEET_RADIUS = 32;
export const SHEET_CONTENT_PADDING = 20;
const SHEET_FOOTER_PADDING_TOP = 12;

export const SHARED_SHEET_STYLES = StyleSheet.create({
  // 위 여백은 HeroUI `BottomSheet.Content`가 플랫폼 손잡이에 맞춰 준다(Android는 손잡이가 내용 위에 그려진다)
  container: { paddingHorizontal: 0, paddingBottom: 0 },
  body: {
    paddingHorizontal: SHEET_CONTENT_PADDING,
    paddingBottom: SHEET_CONTENT_PADDING,
  },
  footer: {
    paddingTop: SHEET_FOOTER_PADDING_TOP,
    paddingHorizontal: SHEET_CONTENT_PADDING,
    paddingBottom: SHEET_CONTENT_PADDING,
  },
});
