export interface BuildReportPromptOptions {
  prevTips: string[] | null;
}

export interface ReportPrompt {
  system: string;
  prompt: string;
}
