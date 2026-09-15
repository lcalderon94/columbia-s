import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './estilos.css';

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      // En un TPV importa más ver el dato fresco que ahorrar peticiones.
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('raiz')!).render(
  <React.StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
