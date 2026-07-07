export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="h-5 w-36 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-4 h-8 w-4/5 animate-pulse rounded-xl bg-white/10" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="hidden h-24 animate-pulse rounded-2xl bg-white/[0.06] sm:block" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {["Cliente", "Valor", "Modulo", "Pendencia"].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
          />
        ))}
      </section>
    </div>
  );
}
