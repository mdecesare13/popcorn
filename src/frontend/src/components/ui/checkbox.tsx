type CheckboxProps = {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    id?: string;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>;
  
  export function Checkbox({
    label,
    checked,
    onChange,
    id,
    ...props
  }: CheckboxProps) {
    return (
      <label className="flex items-center space-x-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          id={id}
          {...props}
        />
        <span className="text-lg">{label}</span>
      </label>
    );
  }