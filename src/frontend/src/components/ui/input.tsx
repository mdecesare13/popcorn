type InputProps = {
    label?: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>;
  
  export function Input({
    label,
    placeholder,
    value,
    onChange,
    error,
    ...props
  }: InputProps) {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xl font-semibold mb-2">
            {label}
          </label>
        )}
        <input
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            error 
              ? 'border-red-500 focus:ring-red-200' 
              : 'border-gray-300 focus:ring-blue-200'
          }`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }