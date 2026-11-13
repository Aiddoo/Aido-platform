declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /** 설정의 "버전 정보"에서 더 새 버전이 있어 스토어를 열었을 때. 버전 문자열은 넣지 않는다 */
    app_update_store_opened: { source: 'settings' };
  }
}
