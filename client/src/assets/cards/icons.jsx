import React from 'react';

/**
 * Group Icon Shapes
 * Exactly matching card.md:
 * - boom: circle
 * - defuse: triangle
 * - attack: square
 * - skip: pentagon
 * - shuffle: star (5-point)
 * - favor: hexagon
 * - peek: octagon
 * - cat: rhombus / diamond
 */

export function CircleIcon({ className = '', size = 16, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function TriangleIcon({ className = '', size = 16, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <polygon points="12,3.5 21,19.5 3,19.5" />
    </svg>
  );
}

export function SquareIcon({ className = '', size = 16, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export function PentagonIcon({ className = '', size = 16, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <polygon points="12,3.2 20.8,9.6 17.4,20 6.6,20 3.2,9.6" />
    </svg>
  );
}

export function StarIcon({ className = '', size = 16, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <polygon points="12,2.5 14.9,8.5 21.5,9.4 16.7,14.1 17.9,20.6 12,17.5 6.1,20.6 7.3,14.1 2.5,9.4 9.1,8.5" />
    </svg>
  );
}

export function HexagonIcon({ className = '', size = 16, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <polygon points="12,3 20.2,7.7 20.2,17.3 12,22 3.8,17.3 3.8,7.7" />
    </svg>
  );
}

export function OctagonIcon({ className = '', size = 16, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <polygon points="8.2,3 15.8,3 21.2,8.4 21.2,16 15.8,21.4 8.2,21.4 2.8,16 2.8,8.4" />
    </svg>
  );
}

export function RhombusIcon({ className = '', size = 16, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <polygon points="12,2.5 21.2,12 12,21.5 2.8,12" />
    </svg>
  );
}

/**
 * Hand-drawn style original cat illustrations per card type
 * Consistent stroke: stroke="currentColor" (or var(--card-ink, #2B2326)),
 * strokeWidth="2.5", strokeLinecap="round", strokeLinejoin="round".
 */

// 1. BOOM: "Mèo tròn, mắt to, lửa nhỏ ở đuôi, vẻ tinh nghịch"
export function BoomIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Round cat body */}
      <path
        d="M 42 74 C 42 48 58 36 80 36 C 102 36 118 48 118 74 C 118 97 100 104 80 104 C 60 104 42 97 42 74 Z"
        fill="currentColor"
        fillOpacity="0.06"
      />

      {/* Cat ears */}
      <polygon points="52,42 44,20 65,34" fill="currentColor" fillOpacity="0.1" />
      <polygon points="108,42 116,20 95,34" fill="currentColor" fillOpacity="0.1" />
      <path d="M 50 32 L 58 38" />
      <path d="M 110 32 L 102 38" />

      {/* Big mischievous eyes */}
      <circle cx="67" cy="58" r="8" fill="#FFFFFF" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="93" cy="58" r="8" fill="#FFFFFF" stroke="currentColor" strokeWidth="2.2" />
      {/* Pupils looking slightly sideways */}
      <circle cx="70" cy="57" r="4.5" fill="currentColor" stroke="none" />
      <circle cx="96" cy="57" r="4.5" fill="currentColor" stroke="none" />
      {/* Catchlights */}
      <circle cx="72" cy="55" r="1.5" fill="#FFFFFF" stroke="none" />
      <circle cx="98" cy="55" r="1.5" fill="#FFFFFF" stroke="none" />

      {/* Tiny nose and mischievous smirk */}
      <polygon points="78,67 82,67 80,70" fill="currentColor" stroke="none" />
      <path d="M 73 72 Q 80 77 80 72 Q 80 77 87 71" />
      <path d="M 83 73 Q 84 76 86 73" />

      {/* Whiskers */}
      <path d="M 48 68 L 32 66" />
      <path d="M 49 73 L 34 76" />
      <path d="M 111 68 L 127 66" />
      <path d="M 110 73 L 125 76" />

      {/* Cute chubby paws */}
      <path d="M 64 97 C 64 90 73 90 75 97" />
      <path d="M 85 97 C 87 90 96 90 96 97" />

      {/* Curled tail leading up to the flame */}
      <path
        d="M 116 82 C 128 85 138 74 135 54 C 132 44 136 36 142 32"
        strokeWidth="3.2"
      />

      {/* Small flame at the tail */}
      <path
        d="M 142 32 C 135 24 133 16 142 8 C 151 16 153 23 147 30 C 145 33 144 32 142 32 Z"
        fill="#EF4444"
        stroke="#B91C1C"
        strokeWidth="1.8"
      />
      <path
        d="M 142 27 C 139 22 139 17 142 13 C 145 17 146 20 143 25 Z"
        fill="#FDE047"
        stroke="none"
      />
      {/* Sparks */}
      <circle cx="132" cy="14" r="1.2" fill="#F59E0B" stroke="none" />
      <circle cx="152" cy="12" r="1.2" fill="#F59E0B" stroke="none" />
      <circle cx="147" cy="4" r="1" fill="#F59E0B" stroke="none" />
    </svg>
  );
}

// 2. DEFUSE: "Kìm nhỏ cầm bằng hai chân mèo, dây đỏ và dây xanh bên cạnh"
export function DefuseIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Severed red wire on the left */}
      <path
        d="M 22 30 C 34 34 46 38 58 32"
        stroke="#DC2626"
        strokeWidth="3.2"
      />
      <path
        d="M 64 42 C 58 52 48 54 36 58"
        stroke="#DC2626"
        strokeWidth="3.2"
      />
      {/* Red wire cut ends with copper core and sparks */}
      <circle cx="58" cy="32" r="1.5" fill="#F59E0B" stroke="none" />
      <circle cx="64" cy="42" r="1.5" fill="#F59E0B" stroke="none" />
      <path d="M 62 34 L 66 30" stroke="#F59E0B" strokeWidth="1.5" />

      {/* Intact curved blue wire on the right */}
      <path
        d="M 98 28 C 114 20 130 26 136 38 C 140 50 130 62 120 66"
        stroke="#2563EB"
        strokeWidth="3.2"
      />

      {/* Cat arms/paws holding the pliers */}
      {/* Left paw */}
      <path
        d="M 18 78 C 32 78 44 75 52 68 C 55 65 60 68 58 74 C 55 80 47 84 36 85"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path d="M 52 68 C 56 67 60 70 58 75 C 56 80 50 81 48 81" />

      {/* Right paw */}
      <path
        d="M 142 78 C 128 78 116 75 108 68 C 105 65 100 68 102 74 C 105 80 113 84 124 85"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path d="M 108 68 C 104 67 100 70 102 75 C 104 80 110 81 112 81" />

      {/* Small pliers in center */}
      {/* Plier jaws */}
      <path
        d="M 76 52 L 72 32 C 75 28 80 30 80 40 Z"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path
        d="M 84 52 L 88 32 C 85 28 80 30 80 40 Z"
        fill="currentColor"
        fillOpacity="0.15"
      />

      {/* Center pivot bolt */}
      <circle cx="80" cy="55" r="4" fill="#FFFFFF" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="80" cy="55" r="1.5" fill="currentColor" stroke="none" />

      {/* Plier handles */}
      <path
        d="M 77 59 L 58 92 C 55 96 61 98 65 94 L 81 63"
        fill="#1F9E89"
        fillOpacity="0.25"
      />
      <path
        d="M 83 59 L 102 92 C 105 96 99 98 95 94 L 79 63"
        fill="#1F9E89"
        fillOpacity="0.25"
      />

      {/* Snipping spark between jaws */}
      <path d="M 78 26 L 82 22" stroke="#F59E0B" strokeWidth="1.5" />
      <path d="M 82 28 L 86 24" stroke="#F59E0B" strokeWidth="1.5" />
    </svg>
  );
}

// 3. ATTACK: "Mèo đang chạy, đuôi dựng cao, có vệt chuyển động phía sau"
export function AttackIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Motion streaks behind the running cat */}
      <line x1="8" y1="46" x2="38" y2="46" strokeWidth="2" strokeDasharray="6 4" />
      <line x1="16" y1="58" x2="48" y2="58" strokeWidth="2.5" />
      <line x1="6" y1="70" x2="36" y2="70" strokeWidth="2" strokeDasharray="8 4" />
      <line x1="18" y1="82" x2="44" y2="82" strokeWidth="2" />
      {/* Dust puffs */}
      <path d="M 38 90 C 34 88 30 90 32 93 C 34 95 38 95 40 93" strokeWidth="1.8" />

      {/* Sprinting cat body */}
      <path
        d="M 56 62 C 68 50 96 50 112 58 C 114 62 110 68 102 70 C 88 74 70 74 58 70 Z"
        fill="currentColor"
        fillOpacity="0.08"
      />

      {/* Head thrust forward */}
      <path
        d="M 110 54 C 114 46 126 46 130 52 C 134 58 130 65 120 67 Z"
        fill="currentColor"
        fillOpacity="0.1"
      />

      {/* Ears pinned back from speed */}
      <polygon points="114,48 104,38 118,44" fill="currentColor" fillOpacity="0.15" />
      <polygon points="122,47 116,36 126,43" fill="currentColor" fillOpacity="0.15" />

      {/* Fierce determined eye */}
      <polygon points="121,54 126,55 122,57" fill="currentColor" stroke="none" />

      {/* Whiskers swept back */}
      <path d="M 124 62 L 136 60" strokeWidth="1.8" />
      <path d="M 123 65 L 134 67" strokeWidth="1.8" />

      {/* Outstretched front legs */}
      <path d="M 112 66 L 134 78 L 144 76" strokeWidth="2.8" />
      <path d="M 106 68 L 122 84 L 128 82" strokeWidth="2.8" />

      {/* Back legs pushing off */}
      <path d="M 64 68 L 46 84 L 36 86" strokeWidth="2.8" />
      <path d="M 60 64 L 52 76 L 44 78" strokeWidth="2.8" />

      {/* Tail held high and proud */}
      <path
        d="M 56 60 C 50 46 44 26 54 16 C 58 12 63 15 62 22 C 60 32 60 46 62 58"
        strokeWidth="3.2"
      />
    </svg>
  );
}

// 4. SKIP: "Mèo cuộn tròn trên gối, chữ 'z' nhỏ bay lên"
export function SkipIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Plump pillow */}
      <path
        d="M 24 74 C 24 62 46 56 80 56 C 114 56 136 62 136 74 C 136 86 114 92 80 92 C 46 92 24 86 24 74 Z"
        fill="currentColor"
        fillOpacity="0.06"
      />
      {/* Pillow corner tufts/seams */}
      <path d="M 24 74 L 32 72" strokeWidth="1.8" />
      <path d="M 136 74 L 128 72" strokeWidth="1.8" />
      <path d="M 44 78 C 56 82 72 82 80 82 C 88 82 104 82 116 78" strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Cat curled up in cozy circle on pillow */}
      <path
        d="M 50 65 C 50 50 66 42 84 44 C 102 46 114 54 112 68 C 110 78 98 80 82 80 C 66 80 50 76 50 65 Z"
        fill="currentColor"
        fillOpacity="0.1"
      />

      {/* Head tucked in peacefully */}
      <path
        d="M 54 60 C 56 54 64 52 70 56 C 74 60 72 68 66 70 Z"
        fill="currentColor"
        fillOpacity="0.12"
      />

      {/* Cat ears lying relaxed */}
      <polygon points="56,50 48,42 58,46" fill="currentColor" fillOpacity="0.15" />
      <polygon points="66,50 64,40 72,46" fill="currentColor" fillOpacity="0.15" />

      {/* Sleeping peaceful eye (soft curved line) */}
      <path d="M 58 60 C 60 63 64 63 66 60" strokeWidth="2.2" />

      {/* Curled tail wrapped around body */}
      <path d="M 112 68 C 110 79 96 82 78 82" strokeWidth="3" />

      {/* Floating "z" letters drifting up */}
      {/* Small z */}
      <path
        d="M 68 36 L 74 36 L 68 42 L 74 42"
        strokeWidth="2"
      />
      {/* Medium Z */}
      <path
        d="M 80 22 L 88 22 L 80 30 L 88 30"
        strokeWidth="2.4"
      />
      {/* Large Z */}
      <path
        d="M 96 8 L 108 8 L 96 20 L 108 20"
        strokeWidth="2.8"
      />
    </svg>
  );
}

// 5. SHUFFLE: "Ba lá bài xoay vòng, mũi tên cong, mèo đẩy bài"
export function ShuffleIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Curved circulating arrows showing card vortex */}
      {/* Top arrow */}
      <path d="M 40 34 A 40 40 0 0 1 96 18" strokeWidth="2.2" strokeDasharray="5 3" />
      <polygon points="90,14 98,18 92,23" fill="currentColor" stroke="none" />

      {/* Bottom arrow */}
      <path d="M 92 78 A 40 40 0 0 1 38 64" strokeWidth="2.2" strokeDasharray="5 3" />
      <polygon points="44,68 36,64 42,59" fill="currentColor" stroke="none" />

      {/* 3 Spinning cards */}
      {/* Card 1: Left */}
      <g transform="translate(46, 42) rotate(-25)">
        <rect x="-14" y="-20" width="28" height="40" rx="3" fill="#FFFFFF" stroke="currentColor" strokeWidth="2.2" />
        <rect x="-10" y="-16" width="20" height="32" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
      </g>

      {/* Card 2: Top Right */}
      <g transform="translate(82, 30) rotate(18)">
        <rect x="-14" y="-20" width="28" height="40" rx="3" fill="#FFFFFF" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="0" cy="0" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      </g>

      {/* Card 3: Bottom Center */}
      <g transform="translate(72, 72) rotate(48)">
        <rect x="-14" y="-20" width="28" height="40" rx="3" fill="#FFFFFF" stroke="currentColor" strokeWidth="2.2" />
        <polygon points="0,-6 5,5 -5,5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      </g>

      {/* Cat peeking in and actively pushing the cards */}
      {/* Cat head */}
      <path
        d="M 118 78 C 122 68 134 68 142 78"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Ears */}
      <polygon points="120,70 118,58 126,66" fill="currentColor" fillOpacity="0.15" />
      <polygon points="134,68 142,60 140,72" fill="currentColor" fillOpacity="0.15" />

      {/* Alert eyes */}
      <path d="M 124 74 C 125 72 127 72 128 74" strokeWidth="2" />

      {/* Paws batting / pushing the cards */}
      {/* Paw pushing lower card */}
      <path
        d="M 98 76 C 92 74 88 77 90 82 C 92 86 98 87 104 84 Z"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Paw swiping upper card */}
      <path
        d="M 112 46 C 106 43 102 46 104 51 C 106 55 112 56 116 53 Z"
        fill="currentColor"
        fillOpacity="0.15"
      />

      {/* Action dashes */}
      <line x1="88" y1="88" x2="82" y2="92" strokeWidth="1.8" />
      <line x1="102" y1="40" x2="98" y2="36" strokeWidth="1.8" />
    </svg>
  );
}

// 6. FAVOR: "Mèo nghiêng đầu, hai chân trước chắp lại, mắt long lanh"
export function FavorIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Cat sitting body */}
      <path
        d="M 56 96 C 56 76 66 68 80 68 C 94 68 104 76 104 96 Z"
        fill="currentColor"
        fillOpacity="0.08"
      />
      {/* Tail wrapped around feet */}
      <path d="M 104 92 C 106 97 98 98 80 98 C 66 98 58 97 56 94" strokeWidth="2.8" />

      {/* Head charmingly tilted by 14 degrees */}
      <g transform="translate(80, 44) rotate(14)">
        {/* Head shape */}
        <path
          d="M -24 0 C -24 -18 24 -18 24 0 C 24 16 -24 16 -24 0 Z"
          fill="#FFFFFF"
          stroke="currentColor"
          strokeWidth="2.5"
        />

        {/* Ears */}
        <polygon points="-20,-8 -24,-26 -8,-14" fill="currentColor" fillOpacity="0.12" />
        <polygon points="20,-8 24,-26 8,-14" fill="currentColor" fillOpacity="0.12" />

        {/* Big sparkling pleading anime eyes */}
        {/* Left eye */}
        <circle cx="-11" cy="0" r="7.5" fill="currentColor" stroke="none" />
        <circle cx="-9" cy="-2.5" r="2.8" fill="#FFFFFF" stroke="none" />
        <circle cx="-13" cy="2.5" r="1.3" fill="#FFFFFF" stroke="none" />

        {/* Right eye */}
        <circle cx="11" cy="0" r="7.5" fill="currentColor" stroke="none" />
        <circle cx="13" cy="-2.5" r="2.8" fill="#FFFFFF" stroke="none" />
        <circle cx="9" cy="2.5" r="1.3" fill="#FFFFFF" stroke="none" />

        {/* Sweet tiny nose & begging mouth */}
        <polygon points="-2,5 2,5 0,7" fill="currentColor" stroke="none" />
        <path d="M -5 8 Q 0 11 0 8 Q 0 11 5 8" strokeWidth="2" />

        {/* Whiskers */}
        <line x1="-18" y1="4" x2="-28" y2="3" strokeWidth="1.6" />
        <line x1="-18" y1="7" x2="-27" y2="8" strokeWidth="1.6" />
        <line x1="18" y1="4" x2="28" y2="3" strokeWidth="1.6" />
        <line x1="18" y1="7" x2="27" y2="8" strokeWidth="1.6" />

        {/* Cute blush cheeks */}
        <circle cx="-17" cy="6" r="3" fill="#E07BA0" fillOpacity="0.4" stroke="none" />
        <circle cx="17" cy="6" r="3" fill="#E07BA0" fillOpacity="0.4" stroke="none" />
      </g>

      {/* Two front paws clasped together at chest in begging pose */}
      <path
        d="M 74 74 C 74 68 78 66 80 66 C 82 66 86 68 86 74 C 86 79 82 82 80 82 C 78 82 74 79 74 74 Z"
        fill="#FFFFFF"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      {/* Seam between clasped paws */}
      <line x1="80" y1="67" x2="80" y2="79" strokeWidth="1.8" />

      {/* Pleading sparkly star glints */}
      <path
        d="M 44 24 Q 44 30 38 30 Q 44 30 44 36 Q 44 30 50 30 Q 44 30 44 24 Z"
        fill="#FBBF24"
        stroke="#D97706"
        strokeWidth="1"
      />
      <path
        d="M 116 26 Q 116 32 110 32 Q 116 32 116 38 Q 116 32 122 32 Q 116 32 116 26 Z"
        fill="#FBBF24"
        stroke="#D97706"
        strokeWidth="1"
      />
    </svg>
  );
}

// 7. PEEK: "Mèo nhìn qua quả cầu pha lê, ba lá mờ phía trên"
export function PeekIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Cat head looking from behind the crystal ball */}
      <path
        d="M 58 52 C 58 36 70 30 80 30 C 90 30 102 36 102 52"
        fill="currentColor"
        fillOpacity="0.08"
      />

      {/* Mystical alert cat ears */}
      <polygon points="62,34 54,16 70,26" fill="currentColor" fillOpacity="0.12" />
      <polygon points="90,26 106,16 98,34" fill="currentColor" fillOpacity="0.12" />

      {/* Curious mystical eyes looking through the crystal ball */}
      <circle cx="72" cy="45" r="5" fill="#FFFFFF" stroke="currentColor" strokeWidth="2" />
      <circle cx="88" cy="45" r="5" fill="#FFFFFF" stroke="currentColor" strokeWidth="2" />
      <circle cx="72" cy="45" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="88" cy="45" r="2.5" fill="currentColor" stroke="none" />

      {/* Ornate stand for crystal ball */}
      <line x1="62" y1="96" x2="98" y2="96" strokeWidth="3" />
      <path d="M 68 96 C 68 90 73 87 80 87 C 87 87 92 90 92 96" fill="currentColor" fillOpacity="0.15" />

      {/* Crystal ball glass sphere */}
      <circle cx="80" cy="68" r="21" fill="#3E7CB1" fillOpacity="0.12" stroke="currentColor" strokeWidth="2.5" />
      {/* Glass reflections */}
      <path d="M 70 56 A 15 15 0 0 1 88 53" strokeWidth="2" />
      <circle cx="86" cy="76" r="1.8" fill="currentColor" fillOpacity="0.3" stroke="none" />

      {/* Cat paws resting on table on either side of the orb */}
      <path
        d="M 52 82 C 48 82 46 86 48 90 C 50 94 56 94 58 90 C 60 86 56 82 52 82 Z"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M 108 82 C 104 82 102 86 104 90 C 106 94 112 94 114 90 C 116 86 112 82 108 82 Z"
        fill="currentColor"
        fillOpacity="0.12"
      />

      {/* Three blurred card shapes hovering above */}
      {/* Left card */}
      <g transform="translate(52, 16) rotate(-12)" opacity="0.7">
        <rect x="-8" y="-12" width="16" height="24" rx="2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2" />
      </g>
      {/* Center card */}
      <g transform="translate(80, 11)" opacity="0.9">
        <rect x="-8" y="-12" width="16" height="24" rx="2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="0" cy="0" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </g>
      {/* Right card */}
      <g transform="translate(108, 16) rotate(12)" opacity="0.7">
        <rect x="-8" y="-12" width="16" height="24" rx="2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2" />
      </g>

      {/* Aura sparkle dots */}
      <circle cx="65" cy="24" r="1.2" fill="#3E7CB1" stroke="none" />
      <circle cx="95" cy="24" r="1.2" fill="#3E7CB1" stroke="none" />
      <circle cx="80" cy="28" r="1.5" fill="#3E7CB1" stroke="none" />
    </svg>
  );
}

// 8. CAT: "Mèo vằn đứng nghiêng, không đạo cụ" (neutral pose, no props)
export function CatIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Full profile of standing tabby cat */}
      {/* Body torso */}
      <path
        d="M 52 56 C 56 68 64 71 78 71 C 90 71 100 72 104 72 C 108 66 112 56 110 52 C 96 46 72 44 60 40 Z"
        fill="currentColor"
        fillOpacity="0.08"
      />

      {/* Standing legs */}
      {/* Front near leg */}
      <path d="M 58 68 L 57 95 C 57 97 64 97 64 95 L 65 70" strokeWidth="2.8" />
      {/* Front far leg */}
      <path d="M 68 70 L 69 93 C 69 95 74 95 74 93 L 75 71" strokeWidth="2.4" opacity="0.8" />
      {/* Back near leg with muscular thigh */}
      <path
        d="M 108 68 C 112 76 110 86 108 95 C 108 97 114 97 115 95 C 117 84 118 70 114 62"
        strokeWidth="2.8"
      />
      {/* Back far leg */}
      <path d="M 98 72 L 99 93 C 99 95 104 95 104 93 L 105 72" strokeWidth="2.4" opacity="0.8" />

      {/* Head facing left in profile */}
      <path
        d="M 54 36 C 48 38 42 42 40 47 C 39 52 44 56 48 56 C 54 56 58 52 60 48 Z"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Nose */}
      <polygon points="38,48 35,50 38,51" fill="currentColor" stroke="none" />
      {/* Calm eye */}
      <path d="M 45 44 C 47 43 50 45 49 48 C 47 48 45 46 45 44 Z" fill="currentColor" stroke="none" />

      {/* Ears */}
      <polygon points="48,36 44,20 56,28" fill="currentColor" fillOpacity="0.15" />
      <polygon points="56,30 62,18 66,30" fill="currentColor" fillOpacity="0.15" />

      {/* Whiskers */}
      <line x1="38" y1="51" x2="26" y2="49" strokeWidth="1.6" />
      <line x1="38" y1="53" x2="28" y2="55" strokeWidth="1.6" />

      {/* Tail held in natural upward curve */}
      <path
        d="M 112 53 C 122 49 130 38 126 24 C 124 20 120 22 121 26 C 123 34 118 43 110 49"
        strokeWidth="3.2"
      />

      {/* Tabby stripes (classic flank and tail markings) */}
      <path d="M 72 48 C 73 54 71 60 72 66" strokeWidth="2.2" />
      <path d="M 82 48 C 84 55 82 61 83 67" strokeWidth="2.2" />
      <path d="M 92 50 C 93 56 91 62 92 68" strokeWidth="2.2" />
      <path d="M 102 52 C 103 58 102 63 103 68" strokeWidth="2" />
      {/* Tail stripes */}
      <line x1="114" y1="47" x2="118" y2="51" strokeWidth="2" />
      <line x1="120" y1="38" x2="125" y2="41" strokeWidth="2" />
      <line x1="124" y1="28" x2="128" y2="30" strokeWidth="2" />
    </svg>
  );
}

/**
 * Card Back Pattern
 * Navy #2E3A4B background with small repeating cat silhouette / paw-print tile pattern.
 * NO text, NO group color, NO group icon — identity must never be revealed.
 */
export function CardBackPattern({ className = '' }) {
  return (
    <svg
      viewBox="0 0 160 224"
      className={className}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="cat-card-back-pattern"
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          {/* Paw print 1 */}
          <g fill="#43556E">
            <ellipse cx="10" cy="11" rx="3.6" ry="2.8" />
            <circle cx="6.5" cy="6.5" r="1.2" />
            <circle cx="9.2" cy="5.2" r="1.2" />
            <circle cx="12" cy="5.5" r="1.2" />
            <circle cx="14" cy="7.2" r="1.1" />
          </g>

          {/* Staggered mini cat silhouette 2 */}
          <g fill="#43556E">
            {/* Body */}
            <path d="M 23 29 C 23 25 25 23.5 26 23.5 C 27 23.5 29 25 29 29 Z" />
            {/* Head */}
            <circle cx="26" cy="21.5" r="2.2" />
            {/* Ears */}
            <polygon points="24.5,20 24,18.5 25.5,19.5" />
            <polygon points="26.5,19.5 28,18.5 27.5,20" />
            {/* Tail */}
            <path
              d="M 28.5 28 C 30.5 28 31 25.5 30 23.5"
              fill="none"
              stroke="#43556E"
              strokeWidth="0.8"
              strokeLinecap="round"
            />
          </g>
        </pattern>
      </defs>

      {/* Navy base */}
      <rect width="100%" height="100%" fill="#2E3A4B" />

      {/* Repeating cat / paw print pattern */}
      <rect width="100%" height="100%" fill="url(#cat-card-back-pattern)" />

      {/* Elegant card-back borders */}
      <rect
        x="8"
        y="8"
        width="144"
        height="208"
        rx="8"
        fill="none"
        stroke="#4B5E7A"
        strokeWidth="1.8"
      />
      <rect
        x="13"
        y="13"
        width="134"
        height="198"
        rx="6"
        fill="none"
        stroke="#3D4E66"
        strokeWidth="0.8"
        strokeDasharray="4 2"
      />

      {/* Subtle symmetrical center medallion */}
      <circle cx="80" cy="112" r="24" fill="#2E3A4B" stroke="#4B5E7A" strokeWidth="1.5" />
      <circle cx="80" cy="112" r="20" fill="none" stroke="#3D4E66" strokeWidth="0.8" strokeDasharray="3 2" />
      {/* Symmetrical neutral cat paws emblem */}
      <g fill="#4B5E7A" transform="translate(80, 112)">
        <ellipse cx="0" cy="1" rx="5" ry="4" />
        <circle cx="-5" cy="-5" r="1.8" />
        <circle cx="-1.5" cy="-7" r="1.8" />
        <circle cx="2.5" cy="-7" r="1.8" />
        <circle cx="6" cy="-5" r="1.8" />
      </g>
    </svg>
  );
}

/**
 * Metadata mappings
 */

export const CARD_COLORS = Object.freeze({
  boom: '#8B1E1E',   // dark red (prominent)
  defuse: '#1F9E89', // jade/teal green (prominent)
  attack: '#D96B2C', // orange
  skip: '#D4951A',   // yellow / golden amber (high contrast with white text)
  shuffle: '#5BA648',// green
  favor: '#E07BA0',  // pink
  peek: '#3E7CB1',   // blue
  cat: '#7B5EA7',    // purple
});

export const GROUP_SHAPES = Object.freeze({
  boom: 'circle',
  defuse: 'triangle',
  attack: 'square',
  skip: 'pentagon',
  shuffle: 'star',
  favor: 'hexagon',
  peek: 'octagon',
  cat: 'rhombus',
});

export const GROUP_ICONS = Object.freeze({
  // By shape
  circle: CircleIcon,
  triangle: TriangleIcon,
  square: SquareIcon,
  pentagon: PentagonIcon,
  star: StarIcon,
  hexagon: HexagonIcon,
  octagon: OctagonIcon,
  rhombus: RhombusIcon,
  diamond: RhombusIcon,

  // By card type
  boom: CircleIcon,
  defuse: TriangleIcon,
  attack: SquareIcon,
  skip: PentagonIcon,
  shuffle: StarIcon,
  favor: HexagonIcon,
  peek: OctagonIcon,
  cat: RhombusIcon,
});

export const CARD_ILLUSTRATIONS = Object.freeze({
  boom: BoomIllustration,
  defuse: DefuseIllustration,
  attack: AttackIllustration,
  skip: SkipIllustration,
  shuffle: ShuffleIllustration,
  favor: FavorIllustration,
  peek: PeekIllustration,
  cat: CatIllustration,
});
