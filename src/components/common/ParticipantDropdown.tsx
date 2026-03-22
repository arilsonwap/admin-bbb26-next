'use client';

import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { getParticipantImage } from '../../utils/avatarUtils';

interface ParticipantOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface ParticipantDropdownProps {
  options: ParticipantOption[];
  value?: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  showAvatars?: boolean;
}

export const ParticipantDropdown: React.FC<ParticipantDropdownProps> = ({
  options,
  value,
  placeholder = 'Selecione participante...',
  onValueChange,
  disabled = false,
  error,
  label,
  showAvatars = true,
}) => {
  const selectedOption = options.find(option => option.value === value);

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
            className={`relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left border ${
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
            } focus:outline-none focus:ring-1 sm:text-sm ${
              disabled ? 'bg-gray-50 cursor-not-allowed' : ''
            }`}
          >
            <span className={`flex items-center truncate ${
              !selectedOption ? 'text-gray-400' : 'text-gray-900'
            }`}>
              {selectedOption && selectedOption.label && selectedOption.label.trim() !== '' && showAvatars && (
                <div className="flex-shrink-0 mr-2">
                  <div className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-200">
                    <img
                      src={getParticipantImage(selectedOption.label)}
                      alt={selectedOption.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              <span className="block truncate">
                {selectedOption?.label || placeholder}
              </span>
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
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
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
                      <span className="flex items-center">
                        {showAvatars && option.label && option.label.trim() !== '' && (
                          <div className="flex-shrink-0 mr-3">
                            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                              <img
                                src={getParticipantImage(option.label)}
                                alt={option.label}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                        <span
                          className={`block truncate ${
                            selected ? 'font-medium' : 'font-normal'
                          }`}
                        >
                          {option.label}
                        </span>
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