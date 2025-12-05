export default function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-lg p-8">
      <h1 className="text-2xl font-semibold text-center text-gray-800 mb-6">
        {title}
      </h1>

      {children}
    </div>
  );
}
