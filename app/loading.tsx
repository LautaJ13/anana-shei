export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8" aria-busy="true" aria-live="polite">
      <div className="h-56 animate-pulse rounded-3xl bg-white" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
      </div>
      <p className="sr-only">Cargando</p>
    </div>
  );
}
