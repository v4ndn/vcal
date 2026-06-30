export default function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-th-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
