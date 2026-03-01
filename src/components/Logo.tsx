// Mugen — 無限 — Infinite Discipline
// The logo is a geometric hexagonal mark with an inner continuous loop,
// representing endless self-improvement with no escape from accountability.

interface LogoProps {
  size?: number;
  showName?: boolean;
  className?: string;
}

export default function Logo({ size = 32, showName = false, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer hexagon */}
        <path
          d="M20 2L35.5885 11V29L20 38L4.41154 29V11L20 2Z"
          stroke="#d4af37"
          strokeWidth="1.5"
          fill="none"
          opacity="0.9"
        />
        {/* Inner hexagon */}
        <path
          d="M20 8L30.3923 14V26L20 32L9.60769 26V14L20 8Z"
          stroke="#d4af37"
          strokeWidth="0.75"
          fill="none"
          opacity="0.35"
        />
        {/* Center mark — infinity-like continuous path */}
        <path
          d="M14 20C14 17.8 15.6 16 17.5 16C19.4 16 20.5 17.5 20 20C19.5 22.5 20.6 24 22.5 24C24.4 24 26 22.2 26 20"
          stroke="#d4af37"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M26 20C26 17.8 24.4 16 22.5 16C20.6 16 19.5 17.5 20 20"
          stroke="#d4af37"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        {/* Corner accent dots */}
        <circle cx="20" cy="2" r="1.2" fill="#d4af37" opacity="0.6" />
        <circle cx="35.5" cy="11" r="1.2" fill="#d4af37" opacity="0.4" />
        <circle cx="35.5" cy="29" r="1.2" fill="#d4af37" opacity="0.4" />
        <circle cx="20" cy="38" r="1.2" fill="#d4af37" opacity="0.6" />
        <circle cx="4.5" cy="29" r="1.2" fill="#d4af37" opacity="0.4" />
        <circle cx="4.5" cy="11" r="1.2" fill="#d4af37" opacity="0.4" />
      </svg>

      {showName && (
        <div>
          <div
            className="font-bold tracking-[0.25em] uppercase leading-none"
            style={{ fontSize: size * 0.45, color: '#f5f5f5', letterSpacing: '0.28em' }}
          >
            Mugen
          </div>
          <div
            className="tracking-[0.35em] uppercase leading-none mt-0.5"
            style={{ fontSize: size * 0.22, color: '#555555' }}
          >
            無限
          </div>
        </div>
      )}
    </div>
  );
}
