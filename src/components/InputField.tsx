interface Props {
  label: string;
  name: string;
  type?: string;
  value: string;
  required?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function InputField({
  label,
  name,
  type = "text",
  value,
  required,
  onChange,
}: Props) {
  return (
    <div>
      <label className="block font-medium mb-1 text-gray-700">{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        required={required}
        onChange={onChange}
        className="w-full px-4 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-md focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition"
      />
    </div>
  );
}
