// LOGO + 「YY手帳 Assistant」(入口頁、登入頁、註冊頁共用)
// 測試版標籤
export function BetaTag({ lang = 'zh' }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs font-medium" style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
      {lang === 'en' ? 'Beta' : '測試版'}
    </span>
  );
}

export default function BrandMark({ size = 'md', beta = false, lang = 'zh' }) {
  const s = size === 'lg'
    ? { img: 'h-16 w-16', name: 'text-2xl', sub: 'text-base' }
    : { img: 'h-14 w-14', name: 'text-xl', sub: 'text-sm' };
  return (
    <span className="flex items-center gap-2.5">
      <img src="/round-logo.png" alt="" className={s.img} />
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className={`${s.name} font-semibold`} style={{ color: 'var(--ink)' }}>YY手帳</span>
        <span className={`${s.sub} text-muted-foreground`}>Assistant</span>
        {beta && <span className="self-center"><BetaTag lang={lang} /></span>}
      </span>
    </span>
  );
}

// 登入、註冊頁上方:放大的 LOGO,進場時跳一下,旁邊有對話泡泡
export function HelloBrand({ greeting, beta = false, lang = 'zh' }) {
  return (
    <span className="flex flex-col items-center">
      <span className="relative">
        <img src="/round-logo.png" alt="" className="brand-hop h-28 w-28 md:h-32 md:w-32" />
        <span className="brand-bubble">{greeting}</span>
      </span>
      <span className="-mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>YY手帳</span>
        <span className="text-base text-muted-foreground">Assistant</span>
        {beta && <span className="self-center"><BetaTag lang={lang} /></span>}
      </span>
    </span>
  );
}
