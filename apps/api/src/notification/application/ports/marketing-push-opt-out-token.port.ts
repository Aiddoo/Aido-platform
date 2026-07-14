export const MARKETING_PUSH_OPT_OUT_TOKEN = Symbol(
	"MARKETING_PUSH_OPT_OUT_TOKEN",
);

export interface MarketingPushOptOutTokenPort {
	issue(userId: string): string;
	verify(token: string): string | null;
}
