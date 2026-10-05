import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createQueryClient } from './api/queryClient';
import { App } from './App';
import './styles/global.css';

async function bootstrap(): Promise<void> {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  try {
    const { startMockWorker } = await import('./mocks/browser');
    await startMockWorker();
  } catch (error) {
    console.warn('Mock API unavailable; ranking and history will report errors.', error);
  }

  const queryClient = createQueryClient();

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
