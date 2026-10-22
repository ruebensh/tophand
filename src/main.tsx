import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// DEV ONLY: backend o'zgarganda tsx watch serverni restart qiladi — sahifa
// /api/health'dagi boot ID o'zgarishini sezib O'ZI reload bo'ladi (qo'lda
// yangilash shart emas). Frontend o'zgarishlarini Vite HMR allaqachon jonli
// qoplaydi; prod'da bu kod umuman ishlamaydi (import.meta.env.DEV=false).
if (import.meta.env.DEV) {
  let lastBoot: string | null = null;
  setInterval(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = await res.json();
      if (!data?.boot) return;
      if (lastBoot !== null && data.boot !== lastBoot) {
        window.location.reload();
        return;
      }
      lastBoot = data.boot;
    } catch {
      // Server restart bo'layotgan payt — keyingi tekshiruvga kutamiz.
    }
  }, 1500);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
