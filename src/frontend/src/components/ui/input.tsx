import { cn } from "@/lib/utils";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  wrapperClassName?: string;
  labelClass?: string;
}

export function Input({
  label,
  placeholder,
  value,
  onChange,
  error,
  className,
  wrapperClassName,
  labelClass,
  ...props
}: InputProps) {
  return (
    <div className={cn("space-y-2", wrapperClassName)}>
      {label && (
        <label className={cn("block text-sm font-medium", labelClass)}>
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full px-3 py-2 border rounded-lg bg-background",
          error ? "border-red-500" : "border-input",
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}