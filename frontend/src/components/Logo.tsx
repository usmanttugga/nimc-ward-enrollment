interface Props {
  size?: number;
  className?: string;
}

export default function Logo({ size = 48, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Orbit ellipse */}
      <ellipse cx="52" cy="50" rx="42" ry="28" stroke="#0d9488" strokeWidth="3" fill="none" transform="rotate(-20 52 50)" />
      <ellipse cx="52" cy="50" rx="42" ry="28" stroke="#134e4a" strokeWidth="1.5" fill="none" transform="rotate(-20 52 50)" strokeDasharray="6 3" />

      {/* "2" */}
      <text x="18" y="62" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="44" fill="url(#tealGrad)">2</text>

      {/* "T" */}
      <text x="50" y="68" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="30" fill="#134e4a" stroke="#0d9488" strokeWidth="1">T</text>

      {/* Plus circle top-right */}
      <circle cx="76" cy="24" r="10" fill="white" stroke="#9ca3af" strokeWidth="1.5" />
      <text x="76" y="29" fontFamily="Arial" fontSize="14" fill="#ef4444" textAnchor="middle" fontWeight="bold">+</text>

      <defs>
        <linearGradient id="tealGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
    </svg>
  );
}
