"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold text-navy">No pudimos cargar esta pantalla</h1>
      <p className="mt-3 text-muted">Probá de nuevo. Si el problema sigue, volvé al inicio.</p>
      <button className="mt-6 h-11 rounded-xl bg-navy px-4 font-semibold text-white" type="button" onClick={reset}>
        Reintentar
      </button>
    </div>
  );
}
