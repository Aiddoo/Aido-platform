import * as Clipboard from 'expo-clipboard';

type ClipboardResult = { success: true } | { success: false; error: unknown };

export const useClipboard = () => {
  const copyToClipboard = async (text: string): Promise<ClipboardResult> => {
    try {
      await Clipboard.setStringAsync(text);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  };

  return { copyToClipboard };
};
