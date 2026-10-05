import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export async function startMockWorker(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
    },
  });
}
