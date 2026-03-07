export interface AiEventMap {
  ai_parse_used: { success: boolean };
  ai_suggestion_acted: { action: 'accept' | 'dismiss' };
  ai_report_viewed: { report_id: number; report_type: string };
}
