import test from 'node:test';
import assert from 'node:assert/strict';
import {loadHomeWeather} from '../server/home-weather.mjs';

const now = Date.parse('2026-11-28T15:10:00Z');
const fixture = ({code = 0, tomorrowHigh = 11} = {}) => ({
  current: {time:'2026-11-29T00:00', temperature_2m:3.7, weather_code:3},
  daily: {time:['2026-11-29','2026-11-30'], weather_code:[3,code], temperature_2m_max:[11,tomorrowHigh]},
});

test('uses Seoul dates across UTC midnight boundaries and rounds the current temperature', async () => {
  const forecast = await loadHomeWeather(url => {
    const endpoint = new URL(url);
    assert.equal(endpoint.hostname,'api.open-meteo.com');
    assert.equal(endpoint.searchParams.get('timezone'),'Asia/Seoul');
    return Response.json(fixture());
  }, now);
  assert.deepEqual(forecast, {
    date:'2026-11-29', city:'서울', condition:'흐림', temperature:4,
    message:'내일은 맑대요. 잠깐 나들이 어때요?',
  });
});

test('picks advice for precipitation, warming and cooling', async () => {
  for (const [options, expected] of [
    [{code:61,tomorrowHigh:2}, /비.*우산/],
    [{code:85}, /눈/],
    [{code:95}, /천둥/],
    [{tomorrowHigh:18}, /7°C쯤 올라가요/],
    [{tomorrowHigh:4}, /7°C쯤 내려가요/],
  ]) {
    const result = await loadHomeWeather(() => Response.json(fixture(options)), now);
    assert.match(result.message, expected);
  }
});

test('rejects unavailable or stale forecasts', async () => {
  await assert.rejects(() => loadHomeWeather(() => new Response(null,{status:503}), now));
  await assert.rejects(() => loadHomeWeather(() => Response.json(fixture()), now + 86_400_000));
});
