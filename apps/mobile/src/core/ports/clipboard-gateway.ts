export interface ClipboardGateway {
  copy(text: string): Promise<void>;
}
