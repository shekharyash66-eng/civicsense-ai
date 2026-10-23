import React, { useState, useEffect } from 'react';
import { Phone, ChevronDown } from 'lucide-react';

export interface CountryCode {
  code: string; // e.g. '+91'
  country: string; // e.g. 'India'
  flag: string; // e.g. '🇮🇳'
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'United States / Canada', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
];

interface PhoneInputProps {
  value: string; // E.164 e.g. +919876543210 or local 9876543210
  onChange: (e164PhoneNumber: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = '98765 43210',
}) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]); // Default +91 India
  const [nationalNumber, setNationalNumber] = useState('');

  // Extract initial national number if value starts with country code
  useEffect(() => {
    if (value && value.startsWith('+')) {
      const match = COUNTRY_CODES.find((c) => value.startsWith(c.code));
      if (match) {
        setSelectedCountry(match);
        setNationalNumber(value.slice(match.code.length).trim());
        return;
      }
    } else if (value && !value.startsWith('+')) {
      setNationalNumber(value);
    }
  }, [value]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const found = COUNTRY_CODES.find((c) => c.code === code) || COUNTRY_CODES[0];
    setSelectedCountry(found);
    const cleanDigits = nationalNumber.replace(/\D/g, '');
    onChange(`${found.code}${cleanDigits}`);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const cleanDigits = inputVal.replace(/\D/g, '');
    setNationalNumber(cleanDigits);
    onChange(`${selectedCountry.code}${cleanDigits}`);
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
        Mobile Phone Number
      </label>
      <div className="flex items-center gap-2">
        {/* Country Code Dropdown Selector */}
        <div className="relative shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer shadow-2xs">
            <span>{selectedCountry.flag}</span>
            <span>{selectedCountry.code}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-0.5" />
          </div>
          <select
            value={selectedCountry.code}
            onChange={handleCountryChange}
            disabled={disabled}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
            aria-label="Select Country Code"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                {c.flag} {c.country} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* Local Number Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Phone className="w-4 h-4" />
          </div>
          <input
            type="tel"
            disabled={disabled}
            value={nationalNumber}
            onChange={handleNumberChange}
            placeholder={placeholder}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all disabled:opacity-50"
          />
        </div>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        E.164 formatted target: <span className="font-mono text-teal-700 dark:text-teal-400">{selectedCountry.code}{nationalNumber}</span>
      </p>
    </div>
  );
};
