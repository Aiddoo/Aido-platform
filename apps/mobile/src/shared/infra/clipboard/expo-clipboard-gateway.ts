import { ClipboardCopyError, type ClipboardGateway } from '@src/core/ports/clipboard-gateway';
import * as Clipboard from 'expo-clipboard';

export const expoClipboardGateway: ClipboardGateway = {
  copy: async (text) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch (error) {
      throw new ClipboardCopyError(error);
    }
  },
};
