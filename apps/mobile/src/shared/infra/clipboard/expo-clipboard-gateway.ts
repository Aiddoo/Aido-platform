import type { ClipboardGateway } from '@src/core/ports/clipboard-gateway';
import * as Clipboard from 'expo-clipboard';

export const expoClipboardGateway: ClipboardGateway = {
  copy: async (text) => {
    await Clipboard.setStringAsync(text);
  },
};
