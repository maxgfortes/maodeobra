let bar = null;
let hideTimer = 0;

function show(text, online) {
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'net-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    document.body.appendChild(bar);
  }
  clearTimeout(hideTimer);
  bar.textContent = text;
  bar.classList.toggle('is-online', online);
  bar.classList.add('is-visible');
  document.documentElement.classList.toggle('is-offline', !online);
  if (online) hideTimer = setTimeout(() => bar.classList.remove('is-visible'), 2500);
}

export function initNetworkStatus() {
  window.addEventListener('offline', () => show('Você está sem conexão. Mostrando o que já foi carregado.', false));
  window.addEventListener('online', () => show('Conexão restabelecida', true));
  if (!navigator.onLine) show('Você está sem conexão. Mostrando o que já foi carregado.', false);
}
