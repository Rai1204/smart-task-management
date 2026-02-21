import React from 'react';

interface FloatingActionButtonProps {
  onClick: () => void;
  label?: string;
  icon?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  label = 'New Task',
  icon = '➕',
}) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 right-8 z-50 group"
      title={label}
      aria-label={label}
    >
      {/* Main FAB Button */}
      <div
        className="w-14 h-14 bg-gradient-to-br from-primary-500 to-accent-500 
        hover:from-primary-600 hover:to-accent-600 
        text-white rounded-full shadow-lg hover:shadow-xl 
        flex items-center justify-center
        transition-all duration-300 ease-out
        transform hover:scale-110 active:scale-95"
      >
        <span className="text-2xl">{icon}</span>
      </div>
      
      {/* Tooltip on hover */}
      <div
        className="absolute bottom-full right-0 mb-2 px-3 py-1.5 
        bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg
        opacity-0 group-hover:opacity-100 pointer-events-none
        transition-opacity duration-200 whitespace-nowrap"
      >
        {label}
        <div className="absolute top-full right-4 -mt-1">
          <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      </div>
      
      {/* Ripple effect */}
      <div
        className="absolute inset-0 rounded-full bg-primary-400 
        animate-ping opacity-20 pointer-events-none"
      ></div>
    </button>
  );
};
