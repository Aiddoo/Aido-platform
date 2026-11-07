export interface ClipboardGateway {
  /** 내용을 읽지 않고 글자가 있는지만 본다(iOS 붙여넣기 허용 배너를 띄우지 않는다) */
  hasContent(): Promise<boolean>;
  paste(): Promise<string>;
  copy(text: string): Promise<void>;
}
