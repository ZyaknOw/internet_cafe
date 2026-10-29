type BrandMarkProps = {
  className?: string;
};

/** Compact computer icon used across the customer and staff portals. */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#103b2c" />
      <rect x="9" y="10" width="30" height="22" rx="3.5" stroke="#f4e8c7" strokeWidth="2.5" />
      <path d="M18 38h12M24 32v6" stroke="#f4e8c7" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M13 14h22v14H13z" fill="#174b37" />
      <path d="M18 23h3l2.5-5 3 8 2.5-4H32" stroke="#c9a96a" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
