import type { ButtonHTMLAttributes, CSSProperties, PropsWithChildren } from 'react';

const buttonStyle: CSSProperties = {
  background: 'var(--as-accent-strong)',
  color: 'white',
  border: '1px solid transparent',
  borderRadius: 8,
  padding: '0.55rem 0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryStyle: CSSProperties = {
  ...buttonStyle,
  background: 'transparent',
  borderColor: 'var(--as-border)',
  color: 'var(--as-text)',
};

export function Button({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return <button {...props} style={variant === 'primary' ? buttonStyle : secondaryStyle} />;
}

export function Panel({ children, title }: PropsWithChildren<{ title?: string }>) {
  return (
    <section
      style={{
        background: 'rgba(18, 26, 43, 0.92)',
        border: '1px solid var(--as-border)',
        borderRadius: 14,
        padding: '1.25rem',
      }}
    >
      {title ? (
        <h2 style={{ marginTop: 0, fontFamily: 'var(--as-display)', fontSize: '1.1rem' }}>{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'approved' || status === 'active'
      ? 'var(--as-accent)'
      : status === 'rejected'
        ? 'var(--as-danger)'
        : status === 'waiting_for_approval'
          ? 'var(--as-warning)'
          : 'var(--as-muted)';
  return (
    <span
      style={{
        display: 'inline-block',
        border: `1px solid ${color}`,
        color,
        borderRadius: 999,
        padding: '0.15rem 0.55rem',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}
