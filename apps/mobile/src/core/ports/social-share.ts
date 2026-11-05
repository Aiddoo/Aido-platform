export interface SocialFeedShare {
  title: string;
  description: string;
  imageUrl: string;
  /** 이미지 원본 크기(px). 메신저가 이 비율로 썸네일을 그린다 */
  imageWidth: number;
  imageHeight: number;
  /** 메신저 앱이 없거나 웹에서 열 때 쓰는 링크 */
  webUrl: string;
  buttonTitle: string;
  /** 메시지의 버튼이 앱을 열 때 넘기는 값 */
  executionParams: Record<string, string>;
}

export interface SocialShareGateway {
  /** 이 빌드에서 쓸 수 있는지. 앱 키가 없으면 다른 공유로 대신한다 */
  isAvailable(): boolean;
  shareFeed(feed: SocialFeedShare): Promise<void>;
}
