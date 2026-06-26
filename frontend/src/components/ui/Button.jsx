import PropTypes from 'prop-types';
import { cn } from '../../utils/cn';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'medium', 
  className, 
  loading = false,
  disabled = false,
  ...props 
}) => {
  const baseClasses = 'font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-deep-teal text-white hover:bg-deep-teal-dark focus:ring-deep-teal disabled:opacity-50',
    secondary: 'bg-accent-blue text-white hover:bg-accent-blue-dark focus:ring-accent-blue disabled:opacity-50',
    cancel: 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400 disabled:opacity-50',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 disabled:opacity-50',
  };
  
  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2.5 text-base',
    large: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        loading && 'opacity-80 pointer-events-none',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
      )}
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'cancel', 'danger']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  className: PropTypes.string,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default Button;
