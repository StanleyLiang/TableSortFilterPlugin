/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useRef } from 'react';

interface FilterDropdownProps {
  uniqueValues: string[];
  currentFilter: string;
  onFilterChange: (value: string) => void;
  onClose: () => void;
  position: { top: number; right: number };
}

export default function FilterDropdown({
  uniqueValues,
  currentFilter,
  onFilterChange,
  onClose,
  position,
}: FilterDropdownProps): JSX.Element {
  const [searchText, setSearchText] = useState(currentFilter);
  const [selectedValue, setSelectedValue] = useState(currentFilter);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dropdown opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Filter options based on search text
  const filteredOptions = uniqueValues.filter((value) =>
    value.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleApply = () => {
    onFilterChange(searchText.trim());
    onClose();
  };

  const handleClear = () => {
    setSearchText('');
    setSelectedValue('');
    onFilterChange('');
    onClose();
  };

  const handleOptionClick = (value: string) => {
    setSearchText(value);
    setSelectedValue(value);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchText(value);
    setSelectedValue(value);
  };

  return (
    <div
      ref={dropdownRef}
      className="table-filter-dropdown"
      style={{
        top: position.top,
        right: position.right,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Search or type to filter..."
        value={searchText}
        onChange={handleSearchChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleApply();
          }
        }}
      />
      
      {filteredOptions.length > 0 && (
        <div className="filter-options">
          {filteredOptions.map((value, index) => (
            <div
              key={index}
              className={`filter-option ${selectedValue === value ? 'selected' : ''}`}
              onClick={() => handleOptionClick(value)}
            >
              {value}
            </div>
          ))}
        </div>
      )}
      
      <div className="filter-actions">
        <button onClick={handleClear}>Clear</button>
        <button onClick={handleApply} className="primary">Apply</button>
      </div>
    </div>
  );
}