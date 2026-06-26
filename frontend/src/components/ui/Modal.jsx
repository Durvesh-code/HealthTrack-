import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../utils/cn';

const Modal = ({ isOpen, onClose, title, children, className }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={cn(
          'relative bg-white rounded-xl shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto',
          'animate-fadeInUp',
          className
        )}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border-light px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-xl font-heading font-bold text-text-primary">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-warm-gray hover:text-text-primary transition-colors text-2xl leading-none p-1"
          >
            ×
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export default Modal;
