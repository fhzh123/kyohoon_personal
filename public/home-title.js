(() => {
  const target = document.querySelector('[data-default-home-title]');
  if (!target) return;

  const key = 'kyohoon-home-title';
  const defaultTitle = target.dataset.defaultHomeTitle;
  const normalize = value => value?.trim() || defaultTitle;
  let title = defaultTitle;
  try { title = normalize(localStorage.getItem(key)); } catch {}

  if (target.matches('h1')) {
    const text = target.querySelector('[data-home-title-text]');
    const period = target.querySelector('[data-home-title-period]');
    const render = value => {
      const hasPeriod = value.endsWith('.');
      text.textContent = hasPeriod ? value.slice(0, -1) : value;
      period.hidden = !hasPeriod;
    };
    render(title);
    addEventListener('storage', event => {
      if (event.key === key || event.key === null) render(normalize(event.newValue));
    });
    return;
  }

  const input = target.elements.namedItem('home-title');
  const reset = target.querySelector('[data-home-title-reset]');
  const status = target.querySelector('[data-home-title-status]');
  input.value = title;

  function save(value) {
    const next = normalize(value);
    try {
      if (next === defaultTitle) localStorage.removeItem(key);
      else localStorage.setItem(key, next);
    } catch {
      status.textContent = '이 브라우저에 제목을 저장할 수 없어요.';
      return;
    }
    input.value = next;
    status.textContent = next === defaultTitle ? '기본 제목을 적용했어요.' : '홈 제목을 저장했어요.';
  }

  input.addEventListener('input', () => { status.textContent = ''; });
  target.addEventListener('submit', event => {
    event.preventDefault();
    save(input.value);
  });
  reset.addEventListener('click', () => save(defaultTitle));
})();
