/** 기상청 단기예보 API Base URL */
export const KMA_BASE_URL =
	"https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

/** 엔드포인트 */
export const KMA_ENDPOINTS = {
	/** 단기예보 조회 (3일, 3시간 간격) */
	VILLAGE_FORECAST: "/getVilageFcst",
	/** 초단기예보 조회 (6시간, 1시간 간격) */
	ULTRA_SHORT_FORECAST: "/getUltraSrtFcst",
	/** 초단기실황 조회 */
	ULTRA_SHORT_LIVE: "/getUltraSrtNcst",
} as const;

/**
 * 기상청 카테고리 코드 → 의미 매핑
 *
 * @see https://www.data.go.kr/data/15084084/openapi.do
 */
export const KMA_CATEGORY = {
	/** 강수확률 (%) */
	POP: "POP",
	/** 강수형태: 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기 */
	PTY: "PTY",
	/** 1시간 강수량 (mm) */
	PCP: "PCP",
	/** 습도 (%) */
	REH: "REH",
	/** 1시간 신적설 (cm) */
	SNO: "SNO",
	/** 하늘상태: 1=맑음, 3=구름많음, 4=흐림 */
	SKY: "SKY",
	/** 1시간 기온 (°C) */
	TMP: "TMP",
	/** 일 최저기온 (°C) */
	TMN: "TMN",
	/** 일 최고기온 (°C) */
	TMX: "TMX",
	/** 풍속 (m/s) */
	WSD: "WSD",
} as const;

/** 하늘상태 코드 → 도메인 타입 매핑 */
export const SKY_CODE_MAP: Record<
	string,
	"CLEAR" | "PARTLY_CLOUDY" | "CLOUDY"
> = {
	"1": "CLEAR",
	"3": "PARTLY_CLOUDY",
	"4": "CLOUDY",
};

/** 강수형태 코드 → 도메인 타입 매핑 */
export const PTY_CODE_MAP: Record<
	string,
	"NONE" | "RAIN" | "RAIN_SNOW" | "SNOW" | "SHOWER"
> = {
	"0": "NONE",
	"1": "RAIN",
	"2": "RAIN_SNOW",
	"3": "SNOW",
	"4": "SHOWER",
};
