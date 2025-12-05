export default function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-md transition disabled:opacity-50"
    >
      {loading ? "Loading..." : label}
    </button>
  );
}
