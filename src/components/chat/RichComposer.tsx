import React from 'react';
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon } from 'lucide-react';

/**
 * RichComposer — chat yozish paneli uchun format vositalari.
 * Faqat CHAT'da ishlatiladi (bildirishnomalar faqat o'qiladi, yozilmaydi).
 * Xavfsizlik: bu yerdagi belgilar (**, *, ~~ ...) yuborilgandan SO'NG RichText
 * komponenti tomonidan React tugunlariga aylantiriladi — HTML qayta tiklanmaydi.
 */

type Kind = 'bold' | 'italic' | 'strike' | 'code' | 'link';

// [ochilish_belgisi, yopilish_belgisi]
const MARKERS: Record<Exclude<Kind, 'link'>, [string, string]> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strike: ['~~', '~~'],
  code: ['`', '`'],
};

interface Result {
  value: string;
  start: number;
  end: number;
}

// Tanlangan matnni marker'lar bilan o'raydi; allaqachon o'ralgan bo'lsa ochadi (toggle).
function wrapSelection(el: HTMLTextAreaElement, prefix: string, suffix: string): Result {
  const s = el.selectionStart;
  const e = el.selectionEnd;
  const v = el.value;
  const sel = v.slice(s, e);
  // toggle OFF: atrofdagi belgilarni olib tashlaymiz
  if (v.slice(s - prefix.length, s) === prefix && v.slice(e, e + suffix.length) === suffix) {
    return {
      value: v.slice(0, s - prefix.length) + sel + v.slice(e + suffix.length),
      start: s - prefix.length,
      end: e - prefix.length,
    };
  }
  const newValue = v.slice(0, s) + prefix + sel + suffix + v.slice(e);
  const innerStart = s + prefix.length;
  return { value: newValue, start: innerStart, end: innerStart + sel.length };
}

// Havola: tanlangan matn URL bo'lsa -> [url](url), aks holda [matn](https://) va
// kursor URL qismiga qo'yiladi (foydalanuvchi davom yozsin).
function wrapLink(el: HTMLTextAreaElement): Result {
  const s = el.selectionStart;
  const e = el.selectionEnd;
  const v = el.value;
  const sel = v.slice(s, e);
  const looksUrl = /^(https?:\/\/|www\.)/i.test(sel);
  const label = sel ? (looksUrl ? 'havola' : sel) : 'matn';
  const url = looksUrl ? (sel.startsWith('http') ? sel : `https://${sel}`) : 'https://';
  const insert = `[${label}](${url})`;
  const newValue = v.slice(0, s) + insert + v.slice(e);
  const urlStart = s + 1 + label.length + 2; // "[" + label + "]("
  return { value: newValue, start: urlStart, end: urlStart + url.length };
}

export function FormatBar({
  textareaRef,
  setText,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  setText: (v: string) => void;
}) {
  const apply = (kind: Kind) => {
    const el = textareaRef.current;
    if (!el) return;
    const r = kind === 'link' ? wrapLink(el) : wrapSelection(el, MARKERS[kind][0], MARKERS[kind][1]);
    setText(r.value);
    el.focus();
    // React yangi value'ni qo'yganidan KEYIN tanlovni tiklaymiz
    setTimeout(() => {
      el.selectionStart = r.start;
      el.selectionEnd = r.end;
    }, 0);
  };

  const btnCls =
    'p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors';

  return (
    <div className="flex items-center gap-0.5 px-1 pb-1.5" role="group" aria-label="Matn formati">
      <button type="button" title="Qalin (**matn**)" aria-label="Qalin" className={btnCls} onClick={() => apply('bold')}>
        <Bold className="w-4 h-4" />
      </button>
      <button type="button" title="Kursiv (*matn*)" aria-label="Kursiv" className={btnCls} onClick={() => apply('italic')}>
        <Italic className="w-4 h-4" />
      </button>
      <button type="button" title="Ustidan chizilgan (~~matn~~)" aria-label="Ustidan chizilgan" className={btnCls} onClick={() => apply('strike')}>
        <Strikethrough className="w-4 h-4" />
      </button>
      <button type="button" title="Kod (`matn`)" aria-label="Kod" className={btnCls} onClick={() => apply('code')}>
        <Code className="w-4 h-4" />
      </button>
      <span className="w-px h-4 bg-gray-200 mx-0.5" />
      <button type="button" title="Havola ([matn](https://...))" aria-label="Havola" className={btnCls} onClick={() => apply('link')}>
        <LinkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// Ko'p qatorli textarea uchun umumiy klaviatura: Enter = yuborish, Shift+Enter = yangi qator.
export function handleComposerKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  onSend: () => void
) {
  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault();
    onSend();
  }
}

// Matn o'zgarganda textarea balandligini kontentga moslab avto-kattalashtirish.
export function autoGrow(el: HTMLTextAreaElement | null, maxPx = 128) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
}
