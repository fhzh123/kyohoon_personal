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

test('accepts a recent observation from before midnight in Seoul', async () => {
  const data = fixture();
  data.current.time = '2026-11-28T23:45';
  const result = await loadHomeWeather(() => Response.json(data), now);
  assert.equal(result.temperature, 4);
  assert.match(result.message, /맑대요/);
});

test('keeps tomorrow’s advice when the current temperature is unavailable', async () => {
  const data = fixture({code:61});
  data.current.temperature_2m = null;
  data.daily.temperature_2m_max[1] = null;
  const result = await loadHomeWeather(() => Response.json(data), now);
  assert.equal(result.temperature, undefined);
  assert.match(result.message, /비.*우산/);
});

test('keeps current weather when tomorrow’s forecast is unavailable', async () => {
  const data = fixture();
  data.daily.weather_code[1] = null;
  const result = await loadHomeWeather(() => Response.json(data), now);
  assert.equal(result.condition, '흐림');
  assert.equal(result.message, undefined);
});
