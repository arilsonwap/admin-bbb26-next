'use client';

import React, { useState, Fragment, useRef, useEffect } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';

interface DropdownOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  placeholder = 'Selecione...',
  onValueChange,
  disabled = false,
  error,
  label,
}) => {
  const selectedOption = options.find(option => option.value === value);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'down' | 'up'>('down');

  useEffect(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(192, options.length * 32); // max-h-48 = 192px, option height ~32px

      // Se não há espaço suficiente embaixo E há espaço suficiente em cima, abrir para cima
      if (spaceBelow < dropdownHeight + 8 && spaceAbove > dropdownHeight + 8) {
        setDropdownPosition('up');
      } else {
        setDropdownPosition('down');
      }
    }
  }, [options.length]);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      <Listbox
        value={value || ''}
        onChange={onValueChange}
        disabled={disabled}
      >
        <div className="relative">
          <Listbox.Button
            ref={buttonRef}
            className={`relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left border ${
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
            } focus:outline-none focus:ring-1 sm:text-sm ${
              disabled ? 'bg-gray-50 cursor-not-allowed' : ''
            }`}
          >
            <span className={`block truncate ${
              !selectedOption ? 'text-gray-400' : 'text-gray-900'
            }`}>
              {selectedOption?.label || placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options
              className={`absolute z-[100] w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm ${
                dropdownPosition === 'up'
                  ? 'bottom-full mb-1 max-h-48'
                  : 'top-full mt-1 max-h-48'
              }`}
            >
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                      active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                    } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`
                  }
                  value={option.value}
                  disabled={option.disabled}
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={`block truncate ${
                          selected ? 'font-medium' : 'font-normal'
                        }`}
                      >
                        {option.label}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};