/** Original CLR letter paths, with a matching gradient O outline and theme-aware CLR. */
export function OclrLogo() {
  return (
    <svg
      className="oclr-wordmark"
      viewBox="0 0 260 92"
      width="106"
      height="33"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="oclr-wordmark-gradient" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ff95c8" />
          <stop offset="43%" stopColor="#ce79e9" />
          <stop offset="100%" stopColor="#975cf4" />
        </linearGradient>
      </defs>
      <path fillRule="evenodd" d="M29 18 H35 C50 18 61 30 61 46 C61 63 50 75 35 75 H29 C14 75 3 63 3 46 C3 30 14 18 29 18 Z M29 36 H35 C40 36 42 39 42 46 C42 53 40 57 35 57 H29 C24 57 22 53 22 46 C22 39 24 36 29 36 Z" fill="url(#oclr-wordmark-gradient)" />
      <g transform="translate(-28 0)" fill="var(--site-foreground, currentColor)">
        <path d="M153 18 H131 C109 18 94 30 94 46 C94 63 109 75 131 75 H153 V57 H132 C120 57 113 53 113 46 C113 39 120 36 132 36 H153 Z" />
        <path d="M160 18 H180 V56 H203 V74 H160 Z" />
        <path fillRule="evenodd" d="M211 18 H244 C266 18 277 28 277 42 C277 53 271 59 262 63 L281 75 H254 L238 60 H231 V75 H211 Z M231 34 V46 H244 C252 46 257 44 257 40 C257 36 253 34 245 34 Z" />
      </g>
    </svg>
  );
}
