import React from 'react';

/**
 * RichText — faqat CHAT va BILDIRISHNOMALAR uchun yengil matn bezatgich.
 * Qo'llab-quvvatlanadi:
 *   • avtomatik havolalar: https://..., http://..., www.... va [matn](https://...) markdown-havolasi
 *   • qalin (**matn**), kursiv (*matn*), ustidan chizilgan (~~matn~~), inline kod (`matn`)
 * Xavfsizlik (XSS): biz HTML'ni qayta tiklamaymiz — matndan faqat React tugunlarini
 * yasaymiz va havola protokolini oq ro'yxat (http/https) bilan cheklaymiz.
 * Yangi qatorlar/joy bo'shliqlari ota-elementning whitespace-pre-wrap/line sinfi bilan saqlanadi.
 */

// Oq ro'yxat: faqat http/https havolalari ochiladi (javascript:, data:, ... rad etiladi).
function safeHref(raw: string): string | null {
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {
    /* yaroqsiz URL */
  }
  return null;
}

// Yalғoz URL'ning nimda turgan so'nggi tinish belgilarini ajratamiz (masalan "...com." → "...com" + ".").
function splitTrailingPunct(url: string): [string, string] {
  const m = url.match(/^(.*?)([.,!?;:)]+)$/);
  return m ? [m[1], m[2]] : [url, ''];
}

// Manba (source) saqlanadi; har bir renderInline chaqiruvda YANGI regex obyekti
// yaratiladi — shunda rekursiv chaqiruvlar ulushlanadigan /g holatini (lastIndex) buzmaydi.
const RE_SOURCE = [
  String.raw`\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)`, // 1,2  markdown-havola
  String.raw`\*\*([^*\n]+)\*\*`, // 3    qalin
  String.raw`~~([^~\n]+)~~`, // 4    ustidan chizilgan
  String.raw`\*([^*\n]+)\*`, // 5    kursiv
  '`([^`\\n]+)`', // 6    inline kod (backtick'lar oddiy satr ichida)
  String.raw`(https?:\/\/[^\s<]+|www\.[^\s<]+)`, // 7    yalғoz URL
].join('|');

function renderInline(text: string, keyBase: string, linkClassName: string): React.ReactNode[] {
  const RE = new RegExp(RE_SOURCE, 'g');
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1] !== undefined) {
      // markdown [matn](url)
      const href = safeHref(m[2]);
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className={linkClassName}>
            {m[1]}
          </a>
        ) : (
          m[0]
        )
      );
    } else if (m[3] !== undefined) {
      out.push(<strong key={key}>{renderInline(m[3], key, linkClassName)}</strong>);
    } else if (m[4] !== undefined) {
      out.push(<s key={key}>{renderInline(m[4], key, linkClassName)}</s>);
    } else if (m[5] !== undefined) {
      out.push(<em key={key}>{renderInline(m[5], key, linkClassName)}</em>);
    } else if (m[6] !== undefined) {
      out.push(
        <code key={key} className="px-1 py-0.5 rounded bg-black/[0.06] font-mono text-[0.92em] break-all">
          {m[6]}
        </code>
      );
    } else if (m[7] !== undefined) {
      const [url, trailing] = splitTrailingPunct(m[7]);
      const href = safeHref(url);
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className={linkClassName}>
            {url}
          </a>
        ) : (
          url
        )
      );
      if (trailing) out.push(trailing);
    }
    last = RE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RichText({
  text,
  linkClassName = 'underline underline-offset-2 break-all',
}: {
  text?: string | null;
  linkClassName?: string;
}) {
  if (!text) return null;
  return <>{renderInline(text, 'rt', linkClassName)}</>;
}
