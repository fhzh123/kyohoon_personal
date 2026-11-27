const ENDPOINT = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
  latitude: '37.5665',
  longitude: '126.9780',
  timezone: 'Asia/Seoul',
  current: 'temperature_2m,weather_code',
  daily: 'weather_code,temperature_2m_max',
  forecast_days: '2',
});

const CONDITIONS = new Map([
  [[0, 1], '맑음'],
  [[2], '구름 조금'],
  [[3], '흐림'],
  [[45, 48], '안개'],
  [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], '비'],
  [[71, 73, 75, 77, 85, 86], '눈'],
  [[95, 96, 97, 99], '뇌우'],
].flatMap(([codes, label]) => codes.map(code => [code, label])));

function tomorrowMessage(condition, todayHigh, tomorrowHigh) {
  if (condition === '뇌우') return '내일은 천둥·번개 예보가 있어요.';
  if (condition === '비') return '내일은 비가 온대요. 우산 챙겨요!';
  if (condition === '눈') return '내일은 눈이 온대요. 따뜻하게 입어요!';
  const change = Number.isFinite(todayHigh) && Number.isFinite(tomorrowHigh)
    ? Math.round(tomorrowHigh - todayHigh)
    : 0;
  if (change <= -7) return '내일은 낮 기온이 ' + Math.abs(change) + '°C쯤 내려가요. 따뜻하게 입어요!';
  if (change >= 7) return '내일은 낮 기온이 ' + change + '°C쯤 올라가요!';
  if (condition === '맑음') {
    return Number.isFinite(tomorrowHigh) && tomorrowHigh < 10 ? '내일은 맑대요. 산책 갈 땐 따뜻하게!' : '내일은 맑대요. 잠깐 나들이 어때요?';
  }
  if (condition === '안개') return '내일은 안개가 낄 수 있어요.';
  return condition === '흐림' ? '내일은 하늘이 흐릴 거래요.' : '내일은 구름이 조금 낀대요.';
}

export async function loadHomeWeather(fetcher, now) {
  const response = await fetcher(ENDPOINT, {signal: AbortSignal.timeout(5000)});
  if (!response.ok) throw new Error('Weather unavailable');
  const {current, daily} = await response.json();
  const formatter = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'});
  const date = formatter.format(now);
  const tomorrowDate = formatter.format(now + 86_400_000);
  const temperature = current?.temperature_2m;
  const condition = CONDITIONS.get(current?.weather_code);
  const tomorrow = CONDITIONS.get(daily?.weather_code?.[1]);
  const [todayHigh, tomorrowHigh] = daily?.temperature_2m_max ?? [];
  const observationTime = Date.parse(current?.time + '+09:00');
  const hasCurrent = condition && Number.isFinite(temperature) && Math.abs(observationTime - now) < 3_600_000;
  const hasTomorrow = tomorrow && daily?.time?.[0] === date && daily.time[1] === tomorrowDate;
  if (!hasCurrent && !hasTomorrow) throw new Error('Incomplete weather forecast');
  return {
    date,
    city: '서울',
    ...(hasCurrent ? {condition, temperature: Math.round(temperature)} : {}),
    ...(hasTomorrow ? {message: tomorrowMessage(tomorrow, todayHigh, tomorrowHigh)} : {}),
  };
}
