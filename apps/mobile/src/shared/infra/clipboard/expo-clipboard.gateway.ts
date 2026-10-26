import type { ClipboardGateway } from '@src/core/ports/clipboard';
import * as Clipboard from 'expo-clipboard';

export const expoClipboardGateway: ClipboardGateway = {
  hasString: () => Clipboard.hasStringAsync(),
  getString: () => Clipboard.getStringAsync(),
  setString: async (text) => {
    await Clipboard.setStringAsync(text);
  },
};
