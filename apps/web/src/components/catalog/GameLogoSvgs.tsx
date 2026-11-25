export function ChainReactionLogoSvg({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 96 72" fill="none">
      {/* 3x3 Mini Grid Base */}
      <rect x="18" y="6" width="60" height="60" rx="7" fill="#ffffff" stroke="#d6d0c4" strokeWidth="1.5" />
      {/* Grid Lines */}
      <line x1="38" y1="6" x2="38" y2="66" stroke="#eeece6" strokeWidth="1.2" />
      <line x1="58" y1="6" x2="58" y2="66" stroke="#eeece6" strokeWidth="1.2" />
      <line x1="18" y1="26" x2="78" y2="26" stroke="#eeece6" strokeWidth="1.2" />
      <line x1="18" y1="46" x2="78" y2="46" stroke="#eeece6" strokeWidth="1.2" />

      {/* Top-Left Cell: Orange single orb */}
      <rect x="20" y="8" width="16" height="16" rx="3" fill="#fff7ed" />
      <circle cx="28" cy="16" r="4.5" fill="#e0530a" />
      <circle cx="26.5" cy="14.5" r="1.4" fill="#ffffff" fillOpacity="0.65" />

      {/* Bottom-Right Cell: Blue double orbs */}
      <rect x="60" y="48" width="16" height="16" rx="3" fill="#eff6ff" />
      <circle cx="65" cy="56" r="3.8" fill="#2563eb" />
      <circle cx="71" cy="56" r="3.8" fill="#2563eb" />
      <circle cx="64" cy="54.8" r="1.1" fill="#ffffff" fillOpacity="0.6" />
      <circle cx="70" cy="54.8" r="1.1" fill="#ffffff" fillOpacity="0.6" />

      {/* Center Burst Cell (Exploding Critical Mass) */}
      <rect x="39" y="27" width="18" height="18" rx="3" fill="#fff7ed" stroke="#e0530a" strokeWidth="1.2" strokeDasharray="2.5 2" />
      <circle cx="48" cy="36" r="6.5" fill="#e0530a" fillOpacity="0.18" />
      {/* Radiating Split Orbs */}
      <circle cx="48" cy="18" r="3.5" fill="#e0530a" stroke="#ffffff" strokeWidth="1" />
      <circle cx="48" cy="54" r="3.5" fill="#e0530a" stroke="#ffffff" strokeWidth="1" />
      <circle cx="30" cy="36" r="3.5" fill="#e0530a" stroke="#ffffff" strokeWidth="1" />
      <circle cx="66" cy="36" r="3.5" fill="#e0530a" stroke="#ffffff" strokeWidth="1" />

      {/* Burst Arrows / Cascade Sparks */}
      <line x1="48" y1="29" x2="48" y2="23" stroke="#e0530a" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="48" y1="43" x2="48" y2="49" stroke="#e0530a" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="41" y1="36" x2="35" y2="36" stroke="#e0530a" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="55" y1="36" x2="61" y2="36" stroke="#e0530a" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="48" cy="36" r="2.5" fill="#fb923c" />
    </svg>
  );
}

export function MiniGolfDuelLogoSvg({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 96 72" fill="none">
      {/* Timber Frame & Fairway Turf */}
      <rect x="8" y="8" width="80" height="56" rx="8" fill="#543220" stroke="#2e1b12" strokeWidth="2" />
      <rect x="12" y="12" width="72" height="48" rx="5" fill="#2c7a36" />
      {/* Putting Green Stripes */}
      <rect x="12" y="12" width="24" height="48" rx="4" fill="#33893e" fillOpacity="0.45" />
      <rect x="60" y="12" width="24" height="48" rx="4" fill="#3ba347" fillOpacity="0.6" />

      {/* Sand Bunker (Bottom-Right) */}
      <ellipse cx="67" cy="48" rx="10" ry="6.5" fill="#eed298" stroke="#bf964b" strokeWidth="1.2" />

      {/* Water Hazard (Top-Left) */}
      <ellipse cx="26" cy="24" rx="9" ry="6" fill="#0284c7" stroke="#075985" strokeWidth="1.2" />
      <path d="M 21 23 Q 26 21 31 23" stroke="#bae6fd" strokeWidth="1" strokeLinecap="round" fill="none" />

      {/* Cup & Flag Pin (Top-Right) */}
      <circle cx="69" cy="24" r="5" fill="#18181b" stroke="#f4f4f5" strokeWidth="1.4" />
      <line x1="69" y1="24" x2="69" y2="5" stroke="#e4e4e7" strokeWidth="1.8" strokeLinecap="round" />
      <polygon points="69,5 81,9.5 69,14" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8" strokeLinejoin="round" />

      {/* Aim Trajectory Line from Orange Ball to Cup */}
      <path d="M 28 48 Q 48 42 64 27" stroke="#facc15" strokeWidth="1.5" strokeDasharray="3 2.5" strokeLinecap="round" fill="none" />

      {/* Blue Golf Ball */}
      <circle cx="42" cy="40" r="4.5" fill="#2563eb" stroke="#1e293b" strokeWidth="1.2" />
      <circle cx="40.6" cy="38.6" r="1.4" fill="#93c5fd" />

      {/* Orange Golf Ball */}
      <circle cx="25" cy="49" r="4.8" fill="#e0530a" stroke="#1e293b" strokeWidth="1.2" />
      <circle cx="23.5" cy="47.5" r="1.5" fill="#ffa07a" />
    </svg>
  );
}

export function UnoNoMercyLogoSvg({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 96 72" fill="none">
      {/* Left tilted Red +4 card */}
      <g transform="translate(27 39) rotate(-18)">
        <rect x="-13" y="-20" width="26" height="40" rx="4.5" fill="#dc2626" stroke="#ffffff" strokeWidth="1.8" />
        <ellipse cx="0" cy="0" rx="9" ry="13" transform="rotate(-12)" fill="#ffffff" fillOpacity="0.94" />
        <text x="0" y="3.5" textAnchor="middle" fill="#dc2626" fontSize="10" fontWeight="900" fontFamily="system-ui, sans-serif">
          +4
        </text>
        <text x="-8.5" y="-12" fill="#ffffff" fontSize="5.5" fontWeight="800" fontFamily="system-ui, sans-serif">
          +4
        </text>
      </g>

      {/* Right tilted Yellow/Green/Blue card */}
      <g transform="translate(69 39) rotate(18)">
        <rect x="-13" y="-20" width="26" height="40" rx="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.8" />
        <ellipse cx="0" cy="0" rx="9" ry="13" transform="rotate(-12)" fill="#ffffff" fillOpacity="0.94" />
        <text x="0" y="3.5" textAnchor="middle" fill="#1d4ed8" fontSize="10" fontWeight="900" fontFamily="system-ui, sans-serif">
          +2
        </text>
        <text x="5.5" y="-12" fill="#ffffff" fontSize="5.5" fontWeight="800" fontFamily="system-ui, sans-serif">
          +2
        </text>
      </g>

      {/* Center Front Obsidian Wild +10 Card */}
      <g transform="translate(48 35)">
        <rect x="-15" y="-23" width="30" height="46" rx="5" fill="#18181b" stroke="#ffffff" strokeWidth="2" />
        {/* 4-Color corner accents */}
        <circle cx="-8.5" cy="-16" r="2" fill="#dc2626" />
        <circle cx="-4" cy="-16" r="2" fill="#eab308" />
        <circle cx="4" cy="16" r="2" fill="#16a34a" />
        <circle cx="8.5" cy="16" r="2" fill="#2563eb" />
        {/* Inner White Oval */}
        <ellipse cx="0" cy="0" rx="10.5" ry="15" transform="rotate(-14)" fill="#ffffff" />
        {/* Bold +10 */}
        <text
          x="0"
          y="4.5"
          textAnchor="middle"
          fill="#18181b"
          fontSize="12"
          fontWeight="900"
          letterSpacing="-0.5"
          fontFamily="system-ui, sans-serif"
        >
          +10
        </text>
      </g>
    </svg>
  );
}
