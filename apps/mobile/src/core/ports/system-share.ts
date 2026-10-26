export interface SystemShareContent {
  /** 링크를 뺀 본문. 링크를 어디에 둘지는 플랫폼 어댑터가 정한다 */
  message: string;
  url: string;
  /** Android 공유 선택 창 제목 */
  dialogTitle: string;
}

export interface SystemShareGateway {
  /** OS 공유 시트를 연다. iOS는 사용자가 닫으면 false이고, Android는 닫아도 true다(OS 한계) */
  share(content: SystemShareContent): Promise<boolean>;
}
