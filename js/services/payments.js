import { appConfig, isPaymentsConfigured } from '../config/firebase-config.js';
import { callFunction } from './firebase.js';

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
let sdkPromise = null;

function loadSdk() {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => resolve(window.MercadoPago);
      s.onerror = () => { sdkPromise = null; reject(new Error('mp-sdk-failed')); };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

export { isPaymentsConfigured };

export async function mountCardBrick(containerId, { amount, email, onSubmit, onReady, onError }) {
  const MercadoPago = await loadSdk();
  const mp = new MercadoPago(appConfig.mercadoPagoPublicKey, { locale: 'pt-BR' });
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const controller = await mp.bricks().create('cardPayment', containerId, {
    initialization: { amount, payer: { email } },
    customization: {
      visual: {
        hidePaymentButton: false,
        style: {
          theme: dark ? 'dark' : 'default',
          customVariables: {
            baseColor: dark ? '#0a84ff' : '#007aff',
            borderRadiusMedium: '12px',
            borderRadiusLarge: '14px',
            fontSizeMedium: '16px',
          },
        },
        texts: { formSubmit: 'Pagar e ativar perfil' },
      },
      paymentMethods: { maxInstallments: 12 },
    },
    callbacks: {
      onReady: () => onReady?.(),
      onSubmit: (formData) => onSubmit(formData),
      onError: (err) => onError?.(err),
    },
  });
  return { unmount: () => controller?.unmount?.() };
}

export function payPlan(planId, formData) {
  return callFunction('createPayment', {
    planId,
    token: formData.token,
    paymentMethodId: formData.payment_method_id,
    issuerId: formData.issuer_id,
    installments: formData.installments,
    payer: formData.payer,
  });
}
