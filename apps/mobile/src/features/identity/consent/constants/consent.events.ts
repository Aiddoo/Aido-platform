declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    ai_data_sharing_consent_changed: { agreed: boolean };
    /** AI 데이터 제공 안내 시트가 뜰 때. 재안내(is_renewal)는 이미 동의한 사람에게 바뀐 내용을 알린다 */
    ai_consent_prompt_shown: { is_renewal: boolean };
    /** [나중에]·끌어 내림으로 답 없이 닫을 때. 부른 화면이 사라져 닫힌 것은 세지 않는다 */
    ai_consent_prompt_dismissed: { is_renewal: boolean };
  }
}

export {};
