(() => {
  const dialog = document.querySelector('#account-help');
  const opener = document.querySelector('[data-contact-open]');
  let previousOverflow = '';
  const open = () => {
    if (!dialog || dialog.open) return;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
  };
  const close = () => { if (dialog?.open) dialog.close(); };
  opener?.addEventListener('click', open);
  dialog?.querySelectorAll('[data-contact-close]').forEach(button => button.addEventListener('click', close));
  dialog?.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  dialog?.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    opener?.focus({preventScroll: true});
  });
  document.querySelector('[data-copy-email]')?.addEventListener('click', async () => {
    const status = dialog.querySelector('.copy-status');
    try {
      await navigator.clipboard.writeText('fhzh@naver.com');
      status.textContent = '이메일 주소를 복사했습니다.';
    } catch {
      status.textContent = 'fhzh@naver.com 주소를 길게 눌러 복사해 주세요.';
    }
  });
  document.querySelector('.password-toggle')?.addEventListener('click', event => {
    const field = document.querySelector('#password');
    const visible = field.type === 'password';
    field.type = visible ? 'text' : 'password';
    event.currentTarget.textContent = visible ? '숨기기' : '보기';
    event.currentTarget.setAttribute('aria-pressed', String(visible));
    event.currentTarget.setAttribute('aria-label', visible ? '비밀번호 숨기기' : '비밀번호 표시');
  });
  document.querySelector('[data-login-form]')?.addEventListener('submit', event => {
    if (event.defaultPrevented) return;
    const button = event.currentTarget.querySelector('[type=submit]');
    button.disabled = true;
    button.querySelector('span').textContent = '로그인 중…';
  });
  window.addEventListener('pageshow', () => {
    const button = document.querySelector('[data-login-form] [type=submit]');
    if (button && document.querySelector('#email')?.disabled === false) {
      button.disabled = false;
      button.querySelector('span').textContent = '로그인';
    }
  });
})();
