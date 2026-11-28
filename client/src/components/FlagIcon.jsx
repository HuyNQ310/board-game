/**
 * Crisp inline SVG flags for Vietnam (VN) and United States (US / EN).
 * Avoids Windows font fallback rendering regional-indicator emojis as plain "VN"/"US" text.
 */

export function FlagVN({ size = 18, className = '' }) {
  const height = Math.round(size * 0.72);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 30 20"
      className={className}
      aria-hidden="true"
      style={{ display: 'inline-block', borderRadius: '2px', flexShrink: 0 }}
    >
      <rect width="30" height="20" fill="#DA251D" rx="2" />
      <polygon
        points="15,4 16.76,9.42 22.46,9.42 17.85,12.77 19.61,18.19 15,14.84 10.39,18.19 12.15,12.77 7.54,9.42 13.24,9.42"
        fill="#FFCD00"
      />
    </svg>
  );
}

export function FlagUS({ size = 18, className = '' }) {
  const height = Math.round(size * 0.72);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 30 20"
      className={className}
      aria-hidden="true"
      style={{ display: 'inline-block', borderRadius: '2px', flexShrink: 0 }}
    >
      <rect width="30" height="20" fill="#FFFFFF" rx="2" />
      <rect y="0" width="30" height="1.54" fill="#B22234" />
      <rect y="3.08" width="30" height="1.54" fill="#B22234" />
      <rect y="6.15" width="30" height="1.54" fill="#B22234" />
      <rect y="9.23" width="30" height="1.54" fill="#B22234" />
      <rect y="12.31" width="30" height="1.54" fill="#B22234" />
      <rect y="15.38" width="30" height="1.54" fill="#B22234" />
      <rect y="18.46" width="30" height="1.54" fill="#B22234" />
      <rect width="13.5" height="10.77" fill="#3C3B6E" />
      <g fill="#FFFFFF">
        <circle cx="2.5" cy="2.2" r="0.7" />
        <circle cx="5.5" cy="2.2" r="0.7" />
        <circle cx="8.5" cy="2.2" r="0.7" />
        <circle cx="11.2" cy="2.2" r="0.7" />
        <circle cx="4" cy="4.3" r="0.7" />
        <circle cx="7" cy="4.3" r="0.7" />
        <circle cx="10" cy="4.3" r="0.7" />
        <circle cx="2.5" cy="6.4" r="0.7" />
        <circle cx="5.5" cy="6.4" r="0.7" />
        <circle cx="8.5" cy="6.4" r="0.7" />
        <circle cx="11.2" cy="6.4" r="0.7" />
        <circle cx="4" cy="8.5" r="0.7" />
        <circle cx="7" cy="8.5" r="0.7" />
        <circle cx="10" cy="8.5" r="0.7" />
      </g>
    </svg>
  );
}

export function LocaleFlag({ locale = 'vi', size = 18, className = '' }) {
  return locale === 'en' ? (
    <FlagUS size={size} className={className} />
  ) : (
    <FlagVN size={size} className={className} />
  );
}

export default LocaleFlag;
