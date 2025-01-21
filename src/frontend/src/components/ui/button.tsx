type ButtonProps = {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary';
    fullWidth?: boolean;
    className?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>;
  
  export function Button({ 
    children, 
    onClick, 
    variant = 'primary', 
    fullWidth = false,
    className = '',
    ...props 
  }: ButtonProps) {
    const baseStyles = "px-6 py-3 rounded-lg font-semibold text-lg transition-colors";
    const variantStyles = {
      primary: "bg-blue-600 hover:bg-blue-700 text-white",
      secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800"
    };
    const widthStyle = fullWidth ? "w-full" : "";
  
    return (
      <button
        onClick={onClick}
        className={`${baseStyles} ${variantStyles[variant]} ${widthStyle} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }