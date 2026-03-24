import { StyleSheet } from 'react-native';

export const SHEET_INDEX = {
  CLOSED: -1,
  OPEN: 0,
} as const;

export const MIN_CONTENT_HEIGHT = 280;
export const TOP_MARGIN = 24;

export const sharedSheetStyles = StyleSheet.create({
  detached: {
    marginHorizontal: 16,
  },
  detachedBackground: {
    borderRadius: 24,
  },
  handleIndicator: {
    width: 36,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
