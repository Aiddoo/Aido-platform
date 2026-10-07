export function resolveMarketingAgreement(agreed: boolean, at: Date): Date | null {
  return agreed ? new Date(at) : null;
}
