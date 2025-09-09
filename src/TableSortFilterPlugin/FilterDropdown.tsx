/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {useState, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';

interface FilterDropdownProps {
  currentFilter: string;
  onFilterChange: (value: string) => void;
  onClose: () => void;
  headerElement: HTMLElement;
}

export default function FilterDropdown({
  currentFilter,
  onFilterChange,
  onClose,
  headerElement,
}: FilterDropdownProps): JSX.Element {
  const [searchText, setSearchText] = useState(currentFilter);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate position based on header element
  const calculatePosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const dropdownWidth = 200; // min-width of dropdown
    
    // Calculate left position, ensuring it doesn't go off-screen
    let left = rect.right - dropdownWidth;
    if (left < 10) { // 10px margin from left edge
      left = rect.left;
    }
    if (left + dropdownWidth > window.innerWidth - 10) { // 10px margin from right edge
      left = window.innerWidth - dropdownWidth - 10;
    }
    
    return {
      top: rect.bottom + window.scrollY,
      left: left,
    };
  };

  // Calculate initial position immediately
  const position = headerElement ? calculatePosition(headerElement) : {top: 0, left: 0};

  // Focus input when dropdown opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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

  const handleApply = () => {
    onFilterChange(searchText.trim());
    onClose();
  };

  const handleClear = () => {
    setSearchText('');
    onFilterChange('');
    onClose();
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value);
  };
  return createPortal(
    <div 
      ref={dropdownRef} 
      className="table-filter-dropdown"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Enter filter value..."
        value={searchText}
        onChange={handleSearchChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleApply();
          }
        }}
      />

      <div className="filter-actions">
        <button onClick={handleClear}>Clear</button>
        <button onClick={handleApply} className="primary">
          Apply
        </button>
      </div>
    </div>,
    document.body,
  );
}
