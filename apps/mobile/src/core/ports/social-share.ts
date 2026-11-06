export interface SocialFeedShare {
  title: string;
  description: string;
  imageUrl: string;
  /** 이미지 원본 크기(px). 메신저가 이 비율로 썸네일을 그린다 */
  imageWidth: number;
  imageHeight: number;
  webUrl: string;
  buttonTitle: string;
  executionParams: Record<string, string>;
}

export interface SocialShareGateway {
  isAvailable(): boolean;
  shareFeed(feed: SocialFeedShare): Promise<void>;
}
