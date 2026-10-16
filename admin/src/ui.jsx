// 管理後台共用的小元件
export function Card({ className = '', children }) {
  return <div className={`rounded-xl border border-border bg-card shadow-sm ${className}`}>{children}</div>;
}

const BTN = {
  primary: 'bg-ink text-white hover:bg-ink/90',
  danger: 'bg-danger text-white hover:bg-danger/90',
  outline: 'border border-border bg-card hover:bg-muted',
  ghost: 'hover:bg-muted',
};
export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${BTN[variant]} ${className}`}
    />
  );
}

export const inputCls = 'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink/30';

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const BADGE = {
  gray: 'bg-muted text-foreground/70',
  ink: 'bg-ink/10 text-ink',
  red: 'bg-danger/10 text-danger',
  green: 'bg-ok/15 text-ok',
  amber: 'bg-warn/15 text-warn',
};
export function Badge({ tone = 'gray', children }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}>{children}</span>;
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1 transition-colors ${value === v ? 'bg-ink text-white' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function PageTitle({ children, right }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-ink">{children}</h1>
      {right}
    </div>
  );
}

export function Notice({ msg }) {
  if (!msg) return null;
  return <p className={`text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</p>;
}
