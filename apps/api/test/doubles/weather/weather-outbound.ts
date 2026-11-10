import { WeatherKitUsageMeterAdapter } from "#api/modules/weather/forecasts/infrastructure/adapters/weatherkit-usage-meter.adapter";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { InMemoryUsageMeterAdapter } from "#test/mocks/in-memory-usage-meter.adapter";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

/**
 * 날씨 공급자 어댑터가 쓰는 공용 회로·계량을 메모리로 만든다.
 * 테스트마다 새로 만들어 회로 상태를 나누지 않는다.
 */
export function createWeatherOutbound(clock: ClockPort) {
  const alert = new RecordingOperationalAlert();
  const meter = new InMemoryUsageMeterAdapter();
  return {
    alert,
    meter,
    policies: new OutboundPolicyRegistry(alert),
    usage: new WeatherKitUsageMeterAdapter(meter, alert, clock),
  };
}
