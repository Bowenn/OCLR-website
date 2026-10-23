/** Inter Display Black outlines keep all four OCLR letters typographically consistent. */
export function OclrLogo() {
  return (
    <svg
      className="oclr-wordmark"
      viewBox="0 0 238 74"
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
      <path fill="url(#oclr-wordmark-gradient)" d="M38.31 65.89C53.32 65.89 65.15 55.85 65.15 37.43C65.15 18.97 53.32 8.89 38.31 8.89C23.23 8.89 11.48 18.97 11.48 37.43C11.48 55.73 23.23 65.89 38.31 65.89ZM38.31 52.55C31.09 52.55 27.05 46.95 27.05 37.43C27.05 27.86 31.09 22.23 38.31 22.23C45.58 22.23 49.58 27.86 49.58 37.43C49.58 46.95 45.58 52.55 38.31 52.55Z" />
      <g fill="var(--site-foreground, currentColor)">
        <path d="M97.94 65.89C112.06 65.89 122.03 57.29 123.59 44.25H108.06C107.1 49.43 103.54 52.55 98.24 52.55C90.72 52.55 86.68 47.06 86.68 37.43C86.68 27.75 90.75 22.23 98.24 22.23C103.54 22.23 107.14 25.38 108.06 30.61H123.59C122.07 17.56 112.06 8.89 97.94 8.89C82.86 8.89 71.11 18.97 71.11 37.43C71.11 55.73 82.86 65.89 97.94 65.89Z" />
        <path d="M130.96 65H170.17V51.95H146.38V9.78H130.96Z" />
        <path d="M177.62 65H193.04V47.73H199.93L208.2 65H224.24L214.13 44.39C219.5 41.21 222.54 35.91 222.54 29.05C222.54 17.23 214.28 9.78 201.08 9.78H177.62ZM193.04 35.8V22.31H199.93C204.57 22.31 207.49 25.01 207.49 29.05C207.49 33.09 204.57 35.8 199.93 35.8Z" />
      </g>
    </svg>
  );
}
