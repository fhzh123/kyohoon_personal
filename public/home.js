(() => {
  const date = document.querySelector('[data-desk-date]');
  const now = new Date();
  const today = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long',
  });
  date.dateTime = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
  date.textContent = today.format(now);

  const weatherLine = document.querySelector('[data-desk-weather]');
  const forecastBubble = document.querySelector('[data-desk-forecast]');
  const weatherSource = document.querySelector('[data-desk-weather-source]');
  let forecastDismissed = false;
  function dismissForecast() {
    forecastDismissed = true;
    forecastBubble.hidden = true;
  }

  const showWeather = (line, message, hasData = false) => {
    weatherLine.textContent = line;
    weatherLine.hidden = false;
    if (!forecastDismissed) {
      forecastBubble.textContent = message;
      forecastBubble.hidden = false;
    }
    weatherSource.hidden = !hasData;
  };

  showWeather('서울 날씨 불러오는 중', '내일 날씨를 확인하고 있어요.');
  const weatherUrl = '/api/home-weather?date=' + encodeURIComponent(date.dateTime);
  // Protected Vercel previews require the same-origin cookie on the API request.
  fetch(weatherUrl, {credentials: 'same-origin', signal: AbortSignal.timeout?.(8000)})
    .then(response => response.ok ? response.json() : null)
    .then(weather => {
      if (weather?.date !== date.dateTime) throw new Error('Weather unavailable');
      const line = weather.condition && Number.isFinite(weather.temperature)
        ? weather.city + ' · ' + weather.condition + ' ' + weather.temperature + '°'
        : '서울 현재 날씨를 확인할 수 없어요';
      showWeather(line, weather.message || '내일 날씨를 아직 못 가져왔어요.', true);
    })
    .catch(() => showWeather('서울 날씨를 불러오지 못했어요', '내일 예보를 아직 못 가져왔어요.'));

  const edit = document.querySelector('[data-desk-edit]');
  const dialog = document.querySelector('[data-desk-dialog]');
  if (edit && dialog) {
    const list = document.querySelector('[data-desk-tools]');
    const options = Array.from(document.querySelector('[data-desk-options]').content.children);
    const choices = Array.from(dialog.querySelectorAll('input[name="tool"]'));
    const error = dialog.querySelector('.desk-dialog-error');
    const shortcutsKey = 'kyohoon-home-shortcuts-' + list.dataset.deskProfile;

    function showTools(ids) {
      const tools = options.filter(tool => ids.includes(tool.dataset.tool));
      if (tools.length > 0 && tools.length <= 3) {
        list.replaceChildren(...tools.map(tool => tool.cloneNode(true)));
      }
    }

    try {
      const saved = JSON.parse(localStorage.getItem(shortcutsKey));
      if (Array.isArray(saved)) showTools(saved);
    } catch {}

    if (typeof dialog.showModal === 'function') {
      edit.hidden = false;
      edit.addEventListener('click', () => {
        const visible = Array.from(list.children, tool => tool.dataset.tool);
        choices.forEach(choice => { choice.checked = visible.includes(choice.value); });
        error.textContent = '';
        dialog.showModal();
      });
      dialog.addEventListener('change', () => { error.textContent = ''; });
      dialog.querySelector('form').addEventListener('submit', event => {
        if (event.submitter?.value === 'cancel') return;
        const selected = choices.filter(choice => choice.checked).map(choice => choice.value);
        event.preventDefault();
        if (selected.length < 1 || selected.length > 3) {
          error.textContent = '도구를 1개에서 3개까지 선택해 주세요.';
          return;
        }
        try {
          localStorage.setItem(shortcutsKey, JSON.stringify(selected));
        } catch {
          error.textContent = '이 브라우저에 바로가기를 저장할 수 없어요.';
          return;
        }
        showTools(selected);
        dialog.close();
      });
    }
  }

  const recent = document.querySelector('[data-desk-recent]');
  if (recent) {
    const link = recent.querySelector('a');
    fetch('/api/paper/recent', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        const project = result?.project;
        if (!project || !['review', 'rebuttal'].includes(project.type) ||
            !/^[0-9a-f-]{36}$/i.test(project.id) || !project.title) return;
        const updated = new Date(project.updated_at);
        const format = new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric',
        });
        const label = project.type === 'review' ? '논문 리뷰' : '논문 리뷰탈';
        link.href = '/paper#' + project.type + '/' + project.id;
        link.querySelector('strong').textContent = project.title;
        link.querySelector('small').textContent = Number.isNaN(updated.valueOf()) ? label : label + ' · ' + format.format(updated) + ' 저장';
      })
      .catch(() => {});
  }

  const stage = document.querySelector('[data-home-stage]');
  const nav = document.querySelector('.home-spaces');
  const mascot = stage.querySelector('[data-default-pose]');
  const poke = stage.querySelector('[data-desk-poke]');
  const feedback = stage.querySelector('.desk-poke-feedback');
  const announcement = stage.querySelector('[data-desk-announce]');
  const changePose = stage.querySelector('[data-desk-pose]');
  const links = Array.from(nav.querySelectorAll('[data-pose]'));
  const original = mascot.getAttribute('src');
  const wardrobe = [original, ...links.map(link => link.dataset.pose)];
  const poseKey = 'kyohoon-home-mascot';
  const validPose = src => typeof src === 'string' && /^\/(?:mascot|gallery\/assets)\/[\w-]+\.(?:png|webp|jpg)$/i.test(src);
  const poseCache = new Map();
  let selectedPose = original;
  let requestedPose = original;
  let feedbackTimer;

  async function showPose(src) {
    requestedPose = src;
    if (mascot.getAttribute('src') === src) return;
    if (!poseCache.has(src)) {
      const image = new Image();
      image.src = src;
      poseCache.set(src, image.decode().then(() => true, () => {
        poseCache.delete(src);
        return false;
      }));
    }
    if (await poseCache.get(src) && requestedPose === src) mascot.src = src;
  }

  if (changePose) {
    try {
      const saved = localStorage.getItem(poseKey);
      if (validPose(saved)) selectedPose = saved;
    } catch {}
    void showPose(selectedPose);

    window.addEventListener('storage', event => {
      if (event.key !== poseKey && event.key !== null) return;
      const src = event.newValue;
      selectedPose = validPose(src) ? src : original;
      dismissForecast();
      void showPose(selectedPose);
    });

    changePose.hidden = false;
    changePose.addEventListener('click', () => {
      selectedPose = wardrobe[(wardrobe.indexOf(selectedPose) + 1) % wardrobe.length];
      try {
        if (selectedPose === original) localStorage.removeItem(poseKey);
        else localStorage.setItem(poseKey, selectedPose);
      } catch {}
      dismissForecast();
      void showPose(selectedPose);
    });
  }

  for (const link of links) {
    const previewPose = () => {
      dismissForecast();
      void showPose(link.dataset.pose);
    };
    link.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') previewPose();
    });
    link.addEventListener('focus', previewPose);
  }
  nav.addEventListener('pointerleave', () => void showPose(document.activeElement?.dataset.pose || selectedPose));
  nav.addEventListener('focusout', event => {
    if (!nav.contains(event.relatedTarget)) void showPose(selectedPose);
  });

  poke.disabled = false;
  poke.addEventListener('click', event => {
    dismissForecast();
    const bounds = poke.getBoundingClientRect();
    const x = event.detail ? (event.clientX - bounds.left) / bounds.width : .76;
    const y = event.detail ? (event.clientY - bounds.top) / bounds.height : .3;
    poke.style.setProperty('--poke-x', Math.min(.83, Math.max(.17, x)) * 100 + '%');
    poke.style.setProperty('--poke-y', Math.max(.24, y) * 100 + '%');
    clearTimeout(feedbackTimer);
    poke.classList.remove('is-poked');
    void poke.offsetWidth;
    poke.classList.add('is-poked');
    feedback.hidden = false;
    announcement.textContent = '콕!';
    feedbackTimer = setTimeout(() => {
      feedback.hidden = true;
      announcement.textContent = '';
      poke.classList.remove('is-poked');
    }, 700);
  });
})();
