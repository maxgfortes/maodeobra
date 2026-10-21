import { icon } from '../ui/icons.js';

document.addEventListener('gesturestart', (e) => e.preventDefault());

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const scroller = () => document.getElementById('shell') || document.scrollingElement;

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export const digits = (v) => String(v ?? '').replace(/\D/g, '');

export function toE164BR(phone) {
  const d = digits(phone);
  if (!d) return '';
  if (d.length >= 12 && d.startsWith('55')) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

export function formatPhoneBR(phone) {
  let d = digits(phone);
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone || '';
}

export function maskPhoneBR(value) {
  const d = digits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function whatsappLink(phone, message = '') {
  const n = toE164BR(phone);
  if (!n) return '';
  const q = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${n}${q}`;
}

export function telLink(phone) {
  const n = toE164BR(phone);
  return n ? `tel:+${n}` : '';
}

export function mailLink(email, subject = '') {
  if (!email) return '';
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `mailto:${encodeURIComponent(email).replace('%40', '@')}${q}`;
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function avatarGradient() {
  return 'var(--tint)';
}

export function avatarHTML(pro, cls = '') {
  const style = `style="background:${avatarGradient()}"`;
  if (pro?.photoURL) {
    return `<div class="avatar ${cls}" ${style}><img src="${esc(pro.photoURL)}" alt="" loading="lazy" decoding="async"></div>`;
  }
  if (!String(pro?.name || '').trim()) {
    return `<div class="avatar ${cls}" aria-hidden="true">${icon('avatar', { cls: 'avatar__ph' })}</div>`;
  }
  return `<div class="avatar ${cls}" ${style} aria-hidden="true">${esc(initials(pro?.name))}</div>`;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch {  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
