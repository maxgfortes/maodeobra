import { getSpec } from '../data/categories.js';
import { listBySpec, peekBySpec } from '../services/professionals.js';
import { pageHead, proRow, emptyState, listSkeleton } from '../ui/components.js';
import { animateIn } from '../ui/motion.js';

function resultsHTML(list, spec, specId) {
  if (!list.length) {
    return emptyState({
      iconName: 'briefcase',
      title: 'Ninguém por aqui ainda',
      text: `Ainda não há profissionais de ${spec.name.toLowerCase()} cadastrados. Conhece alguém? Indique o Guia!`,
      action: '<a class="btn btn--sm btn--secondary" href="signup.html">Sou profissional</a>',
    });
  }
  return `
    <p class="group__header mt-8">${list.length} ${list.length === 1 ? 'profissional' : 'profissionais'}</p>
    <div class="group"><ul class="list list--avatars">${list.map((p) => proRow(p, specId)).join('')}</ul></div>`;
}

export function specListView({ specId }, { root, isStale }) {
  const entry = getSpec(specId);
  if (!entry) {
    root.innerHTML = emptyState({ title: 'Especialidade não encontrada', action: '<a class="btn btn--sm" href="#/explore">Explorar</a>' });
    return;
  }
  const { spec, group, category } = entry;
  const cached = peekBySpec(specId);

  root.innerHTML = `
    ${pageHead({
      title: spec.name,
      crumb: `${category.name} › ${group.name}`,
      backLabel: group.name,
      backHref: `#/c/${category.id}/${group.id}`,
    })}
    <div id="results">${cached ? resultsHTML(cached, spec, specId) : listSkeleton(4)}</div>`;
  if (cached) return;

  const results = root.querySelector('#results');
  listBySpec(specId)
    .then((pros) => {
      if (isStale()) return;
      results.innerHTML = resultsHTML(pros, spec, specId);
      animateIn(results);
    })
    .catch((err) => {
      console.error(err);
      if (isStale()) return;
      results.innerHTML = emptyState({ iconName: 'alertCircle', title: 'Falha ao carregar', text: 'Verifique sua conexão e tente novamente.', action: '<button class="btn btn--sm" onclick="location.reload()">Tentar de novo</button>' });
    });
}
