// ============================================================================
//  CaptchaWidget — Cloudflare Turnstile vidjeti (render=explicit).
//  Sitekey bo'lmasa (xususiyat o'fiq) HECH NARSA chizmaydi. Token olinganda
//  onChange(token) chaqiriladi; muddati tugasa/to'g'ri bo'lmasa onExpire() bilan
//  tozalanadi. Script bir marta global yuklanadi va qayta ishlatiladi.
// ============================================================================

import React, { useEffect, useRef } from 'react';

interface Props {
  sitekey: string | null | undefined;
  onChange: (token: string) => void;
  onExpire?: () => void;
}

let loaderPromise: Promise<any> | null = null;

function loadTurnstile(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as any;
  if (w.turnstile) return Promise.resolve(w.turnstile);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    w.__turnstileOnload = () => resolve(w.turnstile);
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__turnstileOnload';
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      loaderPromise = null;
      reject(new Error('Turnstile script yuklanmadi'));
    };
    document.head.appendChild(s);
  });
  return loaderPromise;
}

const CaptchaWidget: React.FC<Props> = ({ sitekey, onChange, onExpire }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Stale-closure oldini olish: callback'larni refs'da saqlaymiz.
  const onChangeRef = useRef(onChange);
  const onExpireRef = useRef(onExpire);
  onChangeRef.current = onChange;
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!sitekey) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current || !turnstile) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey,
          callback: (token: string) => onChangeRef.current(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => onExpireRef.current?.(),
        });
      })
      .catch(() => {
        /* xususiyat o'fiq holatida muho — jim o'tamiz */
      });
    return () => {
      cancelled = true;
      try {
        const t = (window as any).turnstile;
        if (widgetIdRef.current && t) t.remove(widgetIdRef.current);
      } catch {
        /* e'tiborsiz */
      }
      widgetIdRef.current = null;
    };
  }, [sitekey]);

  if (!sitekey) return null;
  return <div ref={containerRef} className="cf-turnstile" data-sitekey={sitekey} />;
};

export default CaptchaWidget;
