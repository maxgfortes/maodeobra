import { pageHead, namedTile } from '../ui/components.js';
import { chevron } from '../ui/icons.js';
import { esc, whatsappLink, formatPhoneBR } from '../core/utils.js';
import { appConfig } from '../config/firebase-config.js';

const back = { backLabel: 'Perfil', backHref: '#/me' };

export function aboutView() {
  return `
    ${pageHead({ title: 'Sobre', ...back })}
    <div class="group">
      <div class="card prose">
        <p>O <strong>Guia Mão de Obra</strong> conecta quem precisa de um serviço a profissionais da própria região —
          eletricistas, encanadores, diaristas, pintores, técnicos e centenas de outras especialidades.</p>
        <p>Para contratar você não precisa de conta: encontre o profissional, veja o perfil e os trabalhos
          e fale direto pelo WhatsApp, sem intermediários e sem taxas.</p>
        <p>Profissionais criam um perfil com foto, descrição e portfólio e passam a ser encontrados por quem
          busca no seu bairro e na sua cidade.</p>
      </div>
    </div>
    <p class="footer-note">Criado por BloomMore</p>`;
}

export function contactView() {
  const { email = '', whatsapp = '' } = appConfig.contact || {};
  const rows = [
    whatsapp && `<li><a class="row" href="${esc(whatsappLink(whatsapp, 'Olá! Vim pelo Guia Mão de Obra.'))}" target="_blank" rel="noopener">
      ${namedTile('whatsapp')}<div class="row__body"><div class="row__title">WhatsApp</div><div class="row__subtitle">${esc(formatPhoneBR(whatsapp))}</div></div>${chevron}</a></li>`,
    email && `<li><a class="row" href="mailto:${esc(email)}">
      ${namedTile('email')}<div class="row__body"><div class="row__title">E-mail</div><div class="row__subtitle">${esc(email)}</div></div>${chevron}</a></li>`,
  ].filter(Boolean);
  return `
    ${pageHead({ title: 'Contato', subtitle: 'Dúvidas, sugestões ou problemas com um perfil? Fale com a gente.', ...back })}
    ${rows.length
      ? `<div class="group mt-16"><ul class="list list--icons">${rows.join('')}</ul></div>`
      : '<div class="group mt-16"><div class="card prose"><p>Os canais de contato serão publicados em breve.</p></div></div>'}`;
}

export function termsView() {
  return `
    ${pageHead({ title: 'Termos de uso', ...back })}
    <div class="group">
      <div class="card prose">
        <h3>1. O serviço</h3>
        <p>O Guia Mão de Obra é um diretório que divulga profissionais autônomos e empresas. Não prestamos os
          serviços anunciados nem intermediamos a contratação, o preço ou o pagamento entre cliente e profissional.</p>
        <h3>2. Responsabilidades</h3>
        <p>A negociação, a execução e a garantia do serviço são de responsabilidade exclusiva das partes.
          Recomendamos combinar valores, prazos e condições por escrito antes de começar.</p>
        <h3>3. Perfis de profissionais</h3>
        <p>O profissional é responsável pela veracidade das informações, fotos e contatos publicados. Perfis com
          conteúdo falso, ofensivo ou ilegal podem ser ocultados ou removidos a qualquer momento.</p>
        <h3>4. Planos e pagamentos</h3>
        <p>A exibição do perfil nas buscas depende de um plano ativo, pago pelo Mercado Pago. O plano vale pelo
          período contratado e não é renovado automaticamente.</p>
        <h3>5. Privacidade</h3>
        <p>Tratamos os dados conforme a LGPD (Lei 13.709/2018). Dados de perfil são públicos por escolha do
          profissional; dados de login e pagamento não são exibidos. Você pode pedir a exclusão da sua conta
          pelo nosso contato.</p>
        <h3>6. Alterações</h3>
        <p>Estes termos podem ser atualizados. O uso contínuo do serviço após uma alteração significa concordância
          com a nova versão.</p>
      </div>
    </div>`;
}
