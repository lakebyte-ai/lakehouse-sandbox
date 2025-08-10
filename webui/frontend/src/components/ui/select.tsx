import React, { useState } from 'react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  return (
    <div className="relative">
      {React.Children.map(children, child => 
        React.isValidElement(child) 
          ? React.cloneElement(child, { value, onValueChange } as any)
          : child
      )}
    </div>
  );
};

interface SelectTriggerProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ children }) => {
  return (
    <button className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50">
      {children}
      <svg
        className="h-4 w-4 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
};

interface SelectValueProps {
  placeholder?: string;
  value?: string;
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder, value }) => {
  return <span>{value || placeholder}</span>;
};

interface SelectContentProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const SelectContent: React.FC<SelectContentProps> = ({ children, value, onValueChange }) => {
  return (
    <div className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-300 bg-white text-gray-900 shadow-md">
      <div className="p-1">
        {React.Children.map(children, child =>
          React.isValidElement(child)
            ? React.cloneElement(child, { value, onValueChange, selectedValue: value } as any)
            : child
        )}
      </div>
    </div>
  );
};

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  selectedValue?: string;
  onValueChange?: (value: string) => void;
}

export const SelectItem: React.FC<SelectItemProps> = ({ 
  value, 
  children, 
  selectedValue, 
  onValueChange 
}) => {
  const isSelected = value === selectedValue;
  
  return (
    <div
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 ${
        isSelected ? 'bg-gray-100' : ''
      }`}
      onClick={() => onValueChange?.(value)}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>
      )}
      {children}
    </div>
  );
};