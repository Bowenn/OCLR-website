'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="container page" role="alert"><h1>Something went wrong.</h1><p className="muted">Please try again. If the problem continues, return later.</p><button onClick={reset}>Try again</button></div>; }
