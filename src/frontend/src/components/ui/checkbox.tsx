import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  wrapperClassName?: string;
  labelClass?: string;
}

export function Checkbox({
  label,
  checked,
  onChange,
  className,
  wrapperClassName,
  labelClass,
  ...props
}: CheckboxProps) {
  return (
    <label className={cn("flex items-center space-x-3 cursor-pointer", wrapperClassName)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn("form-checkbox h-5 w-5", className)}
        {...props}
      />
      <span className={cn("text-sm", labelClass)}>
        {label}
      </span>
    </label>
  );
}