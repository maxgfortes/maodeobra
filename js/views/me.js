import { pageHead, namedTile } from '../ui/components.js';
import { chevron } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { currentUser, getMyProfile, signOut } from '../services/auth.js';
import { isFirebaseConfigured } from '../services/firebase.js';
import { primarySpecialty } from '../services/professionals.js';
import { esc, avatarHTML } from '../core/utils.js';
import { canInstall, promptInstall, isIOS } from '../core/pwa.js';
import { openSheet } from '../ui/sheet.js';

const BENEFITS = [
  ['perfil-gratis', 'Perfil profissional grátis', 'Foto, capa, descrição e portfólio.'],
  ['whatsapp', 'Clientes no seu WhatsApp', 'Sem intermediários e sem taxas.'],
  ['regiao', 'Seja encontrado na sua região', 'Apareça para quem busca no seu bairro.'],
];

const MORE = [
  ['sobre', '#/sobre', 'Sobre'],
  ['contato', '#/contato', 'Contato'],
  ['termos', '#/termos', 'Termos de uso'],
];

export async function meView(_params, { root, isStale }) {
  root.innerHTML = `${pageHead({ title: 'Perfil' })}<div class="center-spinner"><div class="spinner"></div></div>`;

  let user = null;
  let profile = null;
  try {
    user = await currentUser();
    if (user) profile = await getMyProfile(user.uid);
  } catch (err) {
    console.error(err);
  }
  if (isStale()) return;

  if (!user) renderGuest(root);
  else renderMember(root, user, profile);
  appendInstallRow(root);
  appendFooter(root);
}

const fmtShort = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

function subscriptionRows(profile) {
  const exp = profile.subscription?.expiresAt?.toDate?.();
  const status = profile.active
    ? { img: 'plano-ativo', label: 'Plano ativo', detail: exp ? `até ${fmtShort(exp)}` : 'Ativo' }
    : profile.subscription?.status === 'expired'
      ? { img: 'plano-expirado', label: 'Plano expirado', detail: 'Fora das buscas' }
      : { img: 'plano-pendente', label: 'Pagamento pendente', detail: 'Fora das buscas' };
  const hidden = profile.active && !profile.published
    ? `<li><div class="row">${namedTile('visibilidade')}<div class="row__body"><div class="row__title">Visibilidade</div></div><span class="row__detail">Oculto por você</span></div></li>` : '';
  return `
    <li><div class="row">${namedTile(status.img)}
      <div class="row__body"><div class="row__title">${status.label}</div></div><span class="row__detail">${esc(status.detail)}</span></div></li>
    ${hidden}
    <li><a class="row" href="signup.html#plano">${namedTile('plano')}
      <div class="row__body"><div class="row__title">${profile.active ? 'Renovar plano' : 'Escolher plano e pagar'}</div></div>${chevron}</a></li>`;
}

function renderGuest(root) {
  root.innerHTML = `
    ${pageHead({ title: 'Perfil', subtitle: 'Para buscar e contratar você não precisa de conta.' })}
    <div class="group mt-16">
      <div class="card" style="padding:24px 20px;text-align:center">
        <div style="display:flex;justify-content:center;margin-bottom:14px">${namedTile('profissional', 'icon-tile--lg')}</div>
        <h2 style="margin:0 0 6px;font-size:22px;letter-spacing:.35px">Você presta serviços?</h2>
        <p class="muted" style="margin:0 0 18px;font-size:15px">Cadastre-se em 2 minutos com sua conta Google e comece a receber pedidos.</p>
        <a class="btn btn--block" href="signup.html">Cadastrar meu serviço</a>
        ${isFirebaseConfigured ? '<a class="text-btn mt-8" href="signup.html">Já tenho cadastro · Entrar</a>' : ''}
      </div>
    </div>
    <div class="group">
      <ul class="list list--icons">
        ${BENEFITS.map(([img, title, sub]) => `
          <li><div class="row">
            ${namedTile(img)}
            <div class="row__body"><div class="row__title">${title}</div><div class="row__subtitle">${sub}</div></div>
          </div></li>`).join('')}
      </ul>
    </div>`;
}

function renderMember(root, user, profile) {
  const display = profile || { name: user.displayName || 'Profissional', photoURL: user.photoURL, specs: [] };
  root.innerHTML = `
    ${pageHead({ title: 'Perfil' })}
    <div class="group mt-8">
      <ul class="list">
        <li><a class="row" href="${profile ? `#/p/${esc(user.uid)}` : 'signup.html'}" style="padding-top:12px;padding-bottom:12px">
          ${avatarHTML(display, 'avatar--md')}
          <div class="row__body">
            <div class="row__title" style="font-size:20px;font-weight:600">${esc(display.name)}</div>
            <div class="row__subtitle">${profile ? esc(primarySpecialty(profile)) : 'Cadastro incompleto'} · ${esc(user.email || '')}</div>
          </div>
          ${chevron}
        </a></li>
      </ul>
    </div>

    ${profile ? `
      <div class="group">
        <ul class="list list--icons">
          <li><a class="row" href="#/p/${esc(user.uid)}">${namedTile('ver-perfil')}<div class="row__body"><div class="row__title">Ver perfil público</div></div>${chevron}</a></li>
          <li><a class="row" href="signup.html">${namedTile('editar')}<div class="row__body"><div class="row__title">Editar perfil</div></div>${chevron}</a></li>
          ${subscriptionRows(profile)}
        </ul>
      </div>` : `
      <div class="group">
        <a class="btn btn--block" href="signup.html">Concluir cadastro</a>
        <p class="group__footer">Complete seus dados para aparecer nas buscas.</p>
      </div>`}

    <div class="group">
      <ul class="list"><li><button class="row row--destructive" id="logout">Sair</button></li></ul>
    </div>`;

  root.querySelector('#logout').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      await signOut();
      toast('Você saiu da sua conta', 'success');
      renderGuest(root);
      appendInstallRow(root);
      appendFooter(root);
    } catch {
      toast('Não foi possível sair', 'error');
      e.currentTarget.disabled = false;
    }
  });
}

function appendInstallRow(root) {
  if (!canInstall()) return;
  const group = document.createElement('div');
  group.className = 'group';
  group.innerHTML = `
    <ul class="list list--icons"><li><button class="row" id="install">
      ${namedTile('instalar')}
      <div class="row__body"><div class="row__title">Instalar o app</div><div class="row__subtitle">Acesso rápido pela tela inicial, em tela cheia.</div></div>${chevron}
    </button></li></ul>`;
  root.appendChild(group);
  group.querySelector('#install').addEventListener('click', async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') group.remove();
    if (outcome === 'ios' || (outcome === 'unavailable' && isIOS())) {
      const sheet = openSheet({ title: 'Instalar no iPhone', leftLabel: '', rightLabel: 'OK' });
      sheet.body.innerHTML = `
        <div class="group"><ul class="list list--icons">
          <li><div class="row">${namedTile('compartilhar')}<div class="row__body"><div class="row__title">1. Toque em Compartilhar</div><div class="row__subtitle">Na barra do Safari</div></div></div></li>
          <li><div class="row">${namedTile('adicionar')}<div class="row__body"><div class="row__title">2. “Adicionar à Tela de Início”</div></div></div></li>
          <li><div class="row">${namedTile('pronto')}<div class="row__body"><div class="row__title">3. Toque em Adicionar</div></div></div></li>
        </ul></div>`;
    }
  });
}

function appendFooter(root) {
  const el = document.createElement('div');
  el.innerHTML = `
    <p class="group__header group__header--plain">Mais</p>
    <div class="group">
      <ul class="list list--icons">
        ${MORE.map(([img, href, title]) => `
          <li><a class="row" href="${href}">${namedTile(img)}<div class="row__body"><div class="row__title">${title}</div></div>${chevron}</a></li>`).join('')}
      </ul>
    </div>
    <p class="footer-note">© ${new Date().getFullYear()} Guia Mão de Obra<br>Criado por BloomMore</p>`;
  root.append(...el.children);
}
