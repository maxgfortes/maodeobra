import { getFirebase, callFunction, isFirebaseConfigured } from '../services/firebase.js';
import { signInWithGoogle, signOut, currentUser, authErrorMessage } from '../services/auth.js';
import { compressImage, uploadImage, deleteByUrl, validateImageFile, IMAGE_PRESETS } from '../services/images.js';
import { primarySpecialty } from '../services/professionals.js';
import { getPlan, brl } from '../data/plans.js';
import { getSpec, getCategory } from '../data/categories.js';
import { lineChart, columnChart, barList } from '../ui/charts.js';
import { icon, chevron } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openSheet } from '../ui/sheet.js';
import { actionSheet, confirmSheet } from '../ui/actionsheet.js';
import { animateIn } from '../ui/motion.js';
import { initNetworkStatus } from '../core/network.js';
import { optOutOfTracking } from '../services/analytics.js';
import { esc, normalize, avatarHTML, formatPhoneBR, debounce, haptic } from '../core/utils.js';

initNetworkStatus();

const root = document.getElementById('admin');
const logoutBtn = document.getElementById('logout');
const TABS = [
  ['overview', 'Visão geral'],
  ['pros', 'Profissionais'],
  ['payments', 'Pagamentos'],
  ['banners', 'Banners'],
  ['admins', 'Admins'],
];
let fb = null;
let tab = sessionStorage.getItem('admin:tab') || 'overview';

const fmtDate = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null)
  ?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) || '—';
const fmtDateTime = (ts) => (ts?.toDate?.() || null)
  ?.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) || '—';

boot();

async function boot() {
  if (!isFirebaseConfigured) {
    root.innerHTML = gateHTML('Firebase não configurado', 'Configure js/config/firebase-config.js para usar o console.');
    return;
  }
  fb = await getFirebase();
  const user = await currentUser();
  if (!user) return renderLogin();
  await checkAdmin(user);
}

function gateHTML(title, text, action = '') {
  return `<section class="auth-hero"><div class="auth-hero__art">${icon('briefcase', { stroke: 1.6 })}</div><h1>${esc(title)}</h1><p>${esc(text)}</p>${action}</section>`;
}

function renderLogin() {
  logoutBtn.hidden = true;
  root.innerHTML = gateHTML('Console de administração', 'Entre com uma conta Google autorizada.',
    `<button class="btn btn--block btn--google" id="google">${icon('google')}<span>Entrar com Google</span></button>`);
  root.querySelector('#google').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const user = await signInWithGoogle();
      if (user) await checkAdmin(user);
    } catch (err) {
      toast(authErrorMessage(err), 'error');
      btn.disabled = false;
    }
  });
}

async function checkAdmin(user) {
  root.innerHTML = '<div class="center-spinner" style="padding-top:120px"><div class="spinner"></div></div>';
  let isAdmin = false;
  try {
    const { db, fs } = fb;
    isAdmin = (await fs.getDoc(fs.doc(db, 'admin', user.uid))).exists();
  } catch {}
  logoutBtn.hidden = false;
  logoutBtn.onclick = async () => { await signOut(); renderLogin(); };
  if (!isAdmin) {
    root.innerHTML = gateHTML('Acesso negado', `${user.email} não é administrador. Para liberar, crie no Firestore o documento admin/${user.uid}.`,
      '<a class="btn btn--block btn--secondary" href="index.html">Voltar ao site</a>');
    return;
  }
  optOutOfTracking();
  renderShell();
}

function renderShell() {
  root.innerHTML = `
    <div class="admin-wrap">
      <nav class="segmented" role="tablist">
        ${TABS.map(([id, label]) => `<button role="tab" class="segmented__item ${id === tab ? 'is-active' : ''}" data-tab="${id}" aria-selected="${id === tab}">${label}</button>`).join('')}
      </nav>
      <div id="tab-body"></div>
    </div>`;
  root.querySelector('.segmented').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === tab) return;
    haptic();
    tab = b.dataset.tab;
    sessionStorage.setItem('admin:tab', tab);
    root.querySelectorAll('.segmented__item').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.tab === tab);
      el.setAttribute('aria-selected', el.dataset.tab === tab);
    });
    showTab();
  });
  showTab();
}

function showTab() {
  const body = root.querySelector('#tab-body');
  body.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
  body.classList.remove('fade-swap');
  void body.offsetWidth;
  body.classList.add('fade-swap');
  const views = { overview, pros, payments, banners, admins };
  views[tab](body).catch((err) => {
    console.error(err);
    body.innerHTML = `<div class="empty"><h2 class="empty__title">Erro ao carregar</h2><p>${esc(err.message)}</p></div>`;
  });
}

const PERIODS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']];
const CONTACTS = new Set(['whatsapp', 'call', 'email']);
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const distinct = (list, key) => new Set(list.map((e) => e[key]).filter(Boolean)).size;

function delta(cur, prev) {
  if (!prev) return cur ? 'novo no período' : '';
  const d = Math.round(((cur - prev) / prev) * 100);
  return `${d > 0 ? '+' : ''}${d}% vs período anterior`;
}

function topBy(list, keyFn, n = 8) {
  const m = new Map();
  list.forEach((e) => { const k = keyFn(e); if (k) m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

async function overview(body) {
  const { db, fs } = fb;
  const days = Number(sessionStorage.getItem('admin:period')) || 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  const ts = (d) => fs.Timestamp.fromDate(d);
  const pros = fs.collection(db, 'professionals');
  const pays = fs.collection(db, 'payments');

  const [evSnap, proSnap, total, active, fresh, periodPay, allPay] = await Promise.all([
    fs.getDocs(fs.query(fs.collection(db, 'events'), fs.where('at', '>=', ts(prevStart)), fs.orderBy('at', 'asc'), fs.limit(30000))),
    fs.getDocs(fs.query(pros, fs.orderBy('updatedAt', 'desc'), fs.limit(500))),
    fs.getCountFromServer(pros),
    fs.getCountFromServer(fs.query(pros, fs.where('active', '==', true))),
    fs.getCountFromServer(fs.query(pros, fs.where('createdAt', '>=', ts(start)))),
    fs.getAggregateFromServer(fs.query(pays, fs.where('status', '==', 'approved'), fs.where('approvedAt', '>=', ts(start))), { sum: fs.sum('amount'), count: fs.count() }),
    fs.getAggregateFromServer(fs.query(pays, fs.where('status', '==', 'approved')), { sum: fs.sum('amount'), count: fs.count() }),
  ]);

  const names = new Map(proSnap.docs.map((d) => [d.id, d.get('name') || 'Sem nome']));
  const all = evSnap.docs.map((d) => { const e = d.data(); return { ...e, date: e.at?.toDate?.() || new Date() }; });
  const ev = all.filter((e) => e.date >= start);
  const prev = all.filter((e) => e.date < start);
  const of = (list, t) => list.filter((e) => (typeof t === 'string' ? e.t === t : t(e)));
  const isContact = (e) => CONTACTS.has(e.t);

  const visitors = distinct(ev, 'vid');
  const profileViews = of(ev, 'profile').length;
  const contacts = of(ev, isContact).length;
  const searches = of(ev, 'search');

  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    series.push({ key: dayKey(d), label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), full: d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) });
  }
  const byDay = (list, count) => series.map((s) => ({ ...s, v: count(list.filter((e) => dayKey(e.date) === s.key)) }));
  const visitorSeries = byDay(ev, (l) => distinct(l, 'vid'));
  const contactSeries = byDay(of(ev, isContact), (l) => l.length);
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, full: `das ${h}h às ${h + 1}h`, v: ev.filter((e) => e.t === 'view' && e.date.getHours() === h).length }));

  const sawProfile = new Set(of(ev, 'profile').map((e) => e.vid));
  const contacted = new Set(of(ev, isContact).map((e) => e.vid));
  const funnel = [
    { label: 'Visitaram o site', v: visitors, display: String(visitors) },
    { label: 'Viram um perfil', v: sawProfile.size, display: `${sawProfile.size} · ${pct(sawProfile.size, visitors)}` },
    { label: 'Entraram em contato', v: contacted.size, display: `${contacted.size} · ${pct(contacted.size, visitors)}` },
  ];

  const perPro = new Map();
  ev.forEach((e) => {
    if (!e.p || !(e.t === 'profile' || isContact(e))) return;
    const r = perPro.get(e.p) || { views: 0, contacts: 0 };
    if (e.t === 'profile') r.views += 1; else r.contacts += 1;
    perPro.set(e.p, r);
  });
  const topPros = [...perPro.entries()]
    .sort((a, b) => b[1].contacts - a[1].contacts || b[1].views - a[1].views).slice(0, 8)
    .map(([id, r]) => ({ label: names.get(id) || id, v: r.contacts || r.views, display: `${r.contacts} contatos`, sub: `${r.views} visualizações · taxa de contato ${pct(r.contacts, r.views)}` }));

  const specRows = topBy(of(ev, (e) => e.t === 'view' && e.s), (e) => e.s).map(([id, v]) => ({ label: getSpec(id)?.spec.name || id, v }));
  const catRows = topBy(of(ev, (e) => e.t === 'view' && e.c), (e) => e.c).map(([id, v]) => ({ label: getCategory(id)?.name || id, v }));
  const searchRows = topBy(searches, (e) => e.q).map(([q, v]) => ({ label: q, v }));
  const zeroRows = topBy(searches.filter((e) => e.n === 0), (e) => e.q).map(([q, v]) => ({ label: q, v }));
  const devVisitors = (dv) => distinct(ev.filter((e) => e.dv === dv), 'vid');
  const mob = devVisitors('m');
  const desk = devVisitors('d');
  const deviceRows = [
    { label: 'Celular', v: mob, display: `${mob} · ${pct(mob, mob + desk)}` },
    { label: 'Computador', v: desk, display: `${desk} · ${pct(desk, mob + desk)}` },
  ];
  const sessions = distinct(ev, 'sid');
  const refs = topBy(of(ev, (e) => e.ref), (e) => e.ref, 6);
  const direct = Math.max(sessions - refs.reduce((n, [, v]) => n + v, 0), 0);
  const refRows = [{ label: 'Acesso direto / app', v: direct }, ...refs.map(([r, v]) => ({ label: r, v }))].filter((r) => r.v).sort((a, b) => b.v - a.v);
  const sStart = distinct(of(ev, 'signup_start'), 'vid');
  const sSave = distinct(of(ev, 'signup_save'), 'vid');
  const sPlan = distinct(of(ev, 'plan_view'), 'vid');
  const signupRows = [
    { label: 'Começaram o cadastro', v: sStart, display: String(sStart) },
    { label: 'Salvaram o perfil', v: sSave, display: `${sSave} · ${pct(sSave, sStart)}` },
    { label: 'Viram os planos', v: sPlan, display: `${sPlan} · ${pct(sPlan, sStart)}` },
  ];

  const t = total.data().count;
  const a = active.data().count;
  const card = (title, content, sub = '') => `<section class="card dash-card"><h3 class="dash-card__title">${esc(title)}</h3>${sub ? `<p class="dash-card__sub">${esc(sub)}</p>` : ''}${content}</section>`;

  body.innerHTML = `
    <div class="chips dash-periods" id="periods">
      ${PERIODS.map(([d, l]) => `<button class="chip ${d === days ? 'is-selected' : ''}" data-days="${d}">${l}</button>`).join('')}
    </div>
    ${evSnap.size >= 30000 ? '<p class="notice notice--warning">Muitos eventos no período: mostrando os 30 mil primeiros.</p>' : ''}
    <div class="stats stats--dash">
      ${stat('Visitantes únicos', visitors, '', 'person', delta(visitors, distinct(prev, 'vid')))}
      ${stat('Perfis vistos', profileViews, '', 'eye', delta(profileViews, of(prev, 'profile').length))}
      ${stat('Contatos', contacts, '', 'whatsapp', delta(contacts, of(prev, isContact).length))}
      ${stat('Taxa de contato', pct(contacts, profileViews), '', 'check', 'contatos ÷ perfis vistos')}
      ${stat('Buscas', searches.length, '', 'search', `${searches.filter((e) => e.n === 0).length} sem resultado`)}
      ${stat('Novos profissionais', fresh.data().count, '', 'plus', `${t} no total`)}
      ${stat('Profissionais ativos', a, '', 'sparkles', `${t - a} sem plano ativo`)}
      ${stat('Receita no período', brl(periodPay.data().sum || 0), '', 'briefcase', `${periodPay.data().count} pagamentos · total ${brl(allPay.data().sum || 0)}`)}
    </div>
    ${card('Visitantes por dia', '<div id="ch-visitors"></div>', 'Pessoas diferentes que abriram o site em cada dia')}
    ${card('Contatos por dia', '<div id="ch-contacts"></div>', 'Toques em WhatsApp, ligar e e-mail nos perfis')}
    <div class="dash-grid">
      ${card('Funil de clientes', barList(funnel), 'Do total de visitantes do período')}
      ${card('Profissionais mais procurados', barList(topPros, { empty: 'Nenhum perfil visto no período.' }))}
      ${card('Especialidades mais vistas', barList(specRows))}
      ${card('Categorias mais vistas', barList(catRows))}
      ${card('Mais buscados', barList(searchRows, { empty: 'Nenhuma busca no período.' }))}
      ${card('Buscas sem resultado', barList(zeroRows, { empty: 'Todas as buscas acharam algo.' }), 'O que as pessoas procuram e ainda não tem no Guia')}
      ${card('Acessos por horário', '<div id="ch-hours"></div>', 'Telas abertas em cada hora do dia')}
      ${card('Dispositivos', barList(deviceRows), 'Visitantes por tipo de aparelho')}
      ${card('De onde vieram', barList(refRows), 'Sessões por site de origem')}
      ${card('Funil de cadastro', barList(signupRows), 'Profissionais que começaram a se cadastrar')}
    </div>
    <p class="group__footer mt-16">Os eventos são anônimos (sem nome nem e-mail de quem visita). Admins logados não são contados.</p>`;

  lineChart(body.querySelector('#ch-visitors'), visitorSeries, 'Visitantes');
  columnChart(body.querySelector('#ch-contacts'), contactSeries, 'Contatos');
  columnChart(body.querySelector('#ch-hours'), hours, 'Acessos');
  body.querySelector('#periods').addEventListener('click', (e) => {
    const b = e.target.closest('[data-days]');
    if (!b || Number(b.dataset.days) === days) return;
    sessionStorage.setItem('admin:period', b.dataset.days);
    showTab();
  });
  animateIn(body);
}

function stat(label, value, color, ic, sub = '') {
  return `<div class="stat card"><span class="icon-tile" style="--tile:${color}">${icon(ic)}</span>
    <div class="stat__value">${esc(value)}</div><div class="stat__label">${esc(label)}</div>${sub ? `<div class="stat__sub">${esc(sub)}</div>` : ''}</div>`;
}

function proStatus(p) {
  const exp = p.subscription?.expiresAt;
  if (p.active) return { cls: 'success', label: `Ativo até ${fmtDate(exp)}` };
  const s = p.subscription?.status;
  if (s === 'expired') return { cls: 'warning', label: 'Expirado' };
  if (s === 'revoked') return { cls: 'neutral', label: 'Desativado' };
  if (s === 'refunded') return { cls: 'neutral', label: 'Estornado' };
  return { cls: 'danger', label: 'Pagamento pendente' };
}

async function pros(body) {
  const { db, fs } = fb;
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'professionals'), fs.orderBy('updatedAt', 'desc'), fs.limit(500)));
  let all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  let filter = 'all';
  let term = '';

  body.innerHTML = `
    <div class="searchbar" style="padding:0">
      <label class="search-field">${icon('search')}<input type="search" id="q" placeholder="Nome, e-mail, cidade ou telefone" autocomplete="off"></label>
    </div>
    <div class="chips chips--scroll mt-8" style="padding:0" id="filters">
      ${[['all', 'Todos'], ['active', 'Ativos'], ['pending', 'Pendentes'], ['expired', 'Expirados']].map(([id, l]) => `<button class="chip ${id === 'all' ? 'is-selected' : ''}" data-f="${id}">${l}</button>`).join('')}
    </div>
    <p class="group__header mt-16" id="count" style="margin-left:0"></p>
    <div class="list list--avatars" id="list"></div>`;

  const list = body.querySelector('#list');
  const render = () => {
    if (!list.isConnected) return;
    const q = normalize(term);
    const rows = all.filter((p) => {
      if (filter === 'active' && !p.active) return false;
      if (filter === 'pending' && (p.active || p.subscription?.status === 'expired')) return false;
      if (filter === 'expired' && p.subscription?.status !== 'expired') return false;
      return !q || normalize(`${p.name} ${p.email} ${p.city} ${p.neighborhood} ${p.whatsapp}`).includes(q);
    });
    body.querySelector('#count').textContent = `${rows.length} de ${all.length}`;
    list.innerHTML = rows.length ? rows.map((p) => {
      const st = proStatus(p);
      return `<button class="row pro-row" data-id="${esc(p.id)}">
        ${avatarHTML(p)}
        <div class="row__body">
          <div class="row__title">${esc(p.name)}</div>
          <div class="row__subtitle">${esc(primarySpecialty(p))} · ${esc(p.city)} · ${esc(p.email)}</div>
          <span class="pill pill--${st.cls}">${esc(st.label)}</span>
        </div>${chevron}
      </button>`;
    }).join('') : '<div class="empty"><p>Nenhum profissional encontrado.</p></div>';
  };

  body.querySelector('#q').addEventListener('input', debounce((e) => { term = e.target.value; render(); }, 150));
  body.querySelector('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    body.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('is-selected', c === b));
    render();
  });
  list.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const p = all.find((x) => x.id === row.dataset.id);
    const changed = await proActions(p);
    if (changed === 'deleted') all = all.filter((x) => x.id !== p.id);
    else if (changed) Object.assign(p, changed);
    render();
  });
  render();
  animateIn(body);
}

async function proActions(p) {
  const choice = await actionSheet({
    title: p.name,
    message: `${p.email} · ${formatPhoneBR(p.whatsapp)}`,
    actions: [
      { id: 'view', label: 'Ver perfil público' },
      { id: 'grant30', label: 'Liberar +30 dias' },
      { id: 'grant365', label: 'Liberar +1 ano' },
      ...(p.active ? [{ id: 'revoke', label: 'Desativar perfil', destructive: true }] : []),
      { id: 'delete', label: 'Excluir usuário', destructive: true },
    ],
  });
  if (!choice) return null;
  if (choice === 'view') { window.open(`index.html#/p/${p.id}`, '_blank'); return null; }

  try {
    if (choice.startsWith('grant')) {
      const days = choice === 'grant30' ? 30 : 365;
      const res = await callFunction('adminSetActive', { uid: p.id, active: true, days });
      toast(`Perfil liberado até ${fmtDate(res.expiresAt)}`, 'success');
      return { active: true, subscription: { ...(p.subscription || {}), status: 'active', expiresAt: new Date(res.expiresAt) } };
    }
    if (choice === 'revoke') {
      if (!(await confirmSheet({ title: 'Desativar perfil?', message: 'Ele sai das buscas imediatamente.', confirmLabel: 'Desativar', destructive: true }))) return null;
      await callFunction('adminSetActive', { uid: p.id, active: false });
      toast('Perfil desativado', 'success');
      return { active: false, subscription: { ...(p.subscription || {}), status: 'revoked' } };
    }
    if (choice === 'delete') {
      if (!(await confirmSheet({ title: `Excluir ${p.name}?`, message: 'Remove conta, perfil e fotos. Não pode ser desfeito.', confirmLabel: 'Excluir definitivamente', destructive: true }))) return null;
      await callFunction('adminDeleteUser', { uid: p.id });
      toast('Usuário excluído', 'success');
      return 'deleted';
    }
  } catch (err) {
    console.error(err);
    toast(err.message || 'Operação falhou', 'error', 4000);
  }
  return null;
}

const PAY_STATUS = {
  approved: ['success', 'Aprovado'],
  in_process: ['warning', 'Em análise'],
  pending: ['warning', 'Pendente'],
  rejected: ['danger', 'Recusado'],
  cancelled: ['neutral', 'Cancelado'],
  refunded: ['neutral', 'Estornado'],
  charged_back: ['danger', 'Chargeback'],
};

async function payments(body) {
  const { db, fs } = fb;
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'payments'), fs.orderBy('createdAt', 'desc'), fs.limit(100)));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  body.innerHTML = rows.length ? `
    <p class="group__header" style="margin-left:0">Últimos ${rows.length} pagamentos</p>
    <ul class="list">${rows.map((p) => {
      const [cls, label] = PAY_STATUS[p.status] || ['neutral', p.status];
      return `<li><div class="row">
        <div class="row__body">
          <div class="row__title">${esc(p.name || p.payerEmail || p.uid)}</div>
          <div class="row__subtitle">${esc(getPlan(p.planId)?.name || p.planId)} · ${p.installments > 1 ? `${p.installments}x · ` : ''}${esc(fmtDateTime(p.createdAt))} · nº ${esc(p.id)}</div>
          <span class="pill pill--${cls}">${esc(label)}</span>
        </div>
        <span class="row__detail" style="color:var(--label);font-weight:600">${brl(p.amount || 0)}</span>
      </div></li>`;
    }).join('')}</ul>`
    : '<div class="empty"><h2 class="empty__title">Nenhum pagamento ainda</h2><p>Os pagamentos aparecem aqui assim que forem processados pelo Mercado Pago.</p></div>';
  animateIn(body);
}

async function banners(body) {
  const { db, fs } = fb;
  const snap = await fs.getDocs(fs.collection(db, 'banners'));
  const rows = snap.docs.map((d) => ({ id: d.id, link: d.data().link || '', img: d.data().img || '' }));

  body.innerHTML = `
    <div class="admin-actions"><p class="group__header" style="margin:0">${rows.length} banner(s) · banners/{id} → { link, img }</p>
      <button class="btn btn--sm" id="add">${icon('plus')}Novo banner</button></div>
    <div class="banner-admin">
      ${rows.map((b) => `
        <div class="banner-admin__item card">
          <div class="banner banner--preview">${b.img ? `<img class="banner__img" src="${esc(b.img)}" alt="">` : ''}</div>
          <div class="banner-admin__bar">
            <span class="pill pill--neutral">${esc(b.link || 'Sem link')}</span>
            <span class="spacer"></span>
            <button class="round-btn" data-edit="${b.id}" aria-label="Editar">${icon('edit')}</button>
            <button class="round-btn round-btn--danger" data-del="${b.id}" aria-label="Excluir">${icon('trash')}</button>
          </div>
        </div>`).join('') || '<div class="empty"><p>Nenhum banner. Sem banners, a home não mostra o carrossel.</p></div>'}
    </div>`;

  body.querySelector('#add').addEventListener('click', () => editBanner(null));
  body.querySelector('.banner-admin').addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.edit) editBanner(rows.find((r) => r.id === t.dataset.edit));
    if (t.dataset.del) {
      const b = rows.find((r) => r.id === t.dataset.del);
      if (!(await confirmSheet({ title: 'Excluir banner?', message: b.link, confirmLabel: 'Excluir', destructive: true }))) return;
      await fs.deleteDoc(fs.doc(db, 'banners', b.id));
      if (b.img) deleteByUrl(b.img);
      toast('Banner excluído', 'success');
      showTab();
    }
  });
  animateIn(body);
}

function editBanner(b) {
  const { db, fs } = fb;
  let file = null;
  const sheet = openSheet({
    title: b ? 'Editar banner' : 'Novo banner',
    rightLabel: 'Salvar',
    onRight: () => { save(); return false; },
  });
  sheet.body.innerHTML = `
    <form id="bf" class="banner-form" novalidate>
      <div class="banner banner--preview" id="bprev"></div>
      <p class="group__header mt-16">Banner</p>
      <div class="group"><div class="list">
        <label class="field"><span class="field__label">Imagem</span><input name="image" type="file" accept="image/*"></label>
        <label class="field"><span class="field__label">Link</span><input name="link" maxlength="500" value="${esc(b?.link || '')}" placeholder="#/s/eletricista ou https://…"></label>
      </div><p class="group__footer">Imagem larga (ex.: 1600×640), ocupa a tela de ponta a ponta. Links internos começam com #/ (ex.: #/c/reformas). Externos com https://.</p></div>
    </form>`;

  const form = sheet.body.querySelector('#bf');
  const prev = sheet.body.querySelector('#bprev');
  let imgURL = b?.img || '';
  const paint = () => { prev.innerHTML = imgURL ? `<img class="banner__img is-loaded" src="${esc(imgURL)}" alt="">` : ''; };
  form.elements.image.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const err = validateImageFile(f);
    if (err) { toast(err, 'error'); return; }
    file = f;
    imgURL = URL.createObjectURL(f);
    paint();
  });
  paint();

  async function save() {
    const link = form.elements.link.value.trim();
    if (!imgURL) { toast('Escolha uma imagem', 'error'); return; }
    if (link && !/^(#\/|signup\.html|https:\/\/)/.test(link)) { toast('Link deve começar com #/ ou https://', 'error'); return; }
    const btn = sheet.el.querySelector('[data-right]');
    btn.disabled = true;
    try {
      const ref = b ? fs.doc(db, 'banners', b.id) : fs.doc(fs.collection(db, 'banners'));
      let img = b?.img || '';
      if (file) {
        const blob = await compressImage(file, IMAGE_PRESETS.banner);
        img = await uploadImage(`banners/${ref.id}-${Date.now()}.jpg`, blob);
        if (b?.img) deleteByUrl(b.img);
      }
      await fs.setDoc(ref, { link, img });
      toast('Banner salvo', 'success');
      sheet.close();
      showTab();
    } catch (err) {
      console.error(err);
      toast('Não foi possível salvar o banner', 'error');
      btn.disabled = false;
    }
  }
}

async function admins(body) {
  body.innerHTML = `
    <p class="group__header" style="margin-left:0">Conceder ou remover acesso</p>
    <form class="list" id="af">
      <label class="field"><span class="field__label">E-mail</span><input name="email" type="email" required placeholder="pessoa@gmail.com"></label>
    </form>
    <p class="group__footer" style="margin-left:0">A pessoa precisa ter entrado no site com Google ao menos uma vez. O acesso vale no próximo login dela.</p>
    <div class="admin-actions mt-16">
      <button class="btn btn--sm" data-role="1">Tornar admin</button>
      <button class="btn btn--sm btn--secondary" data-role="0">Remover admin</button>
    </div>`;
  body.querySelector('.admin-actions').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-role]');
    if (!b) return;
    const email = body.querySelector('[name=email]').value.trim();
    if (!email) { toast('Informe o e-mail', 'error'); return; }
    b.disabled = true;
    try {
      await callFunction('adminSetRole', { email, admin: b.dataset.role === '1' });
      toast(b.dataset.role === '1' ? `${email} agora é admin` : `Acesso removido de ${email}`, 'success');
    } catch (err) {
      toast(err.message || 'Falhou', 'error');
    } finally {
      b.disabled = false;
    }
  });
}
