/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$getNearestNodeFromDOMNode, type LexicalNode} from 'lexical';
import {TableNode} from '@lexical/table';
import {useEffect, useState} from 'react';
import './styles.css';
import type {TableSortState, TableFilterState} from './types';
import {
  $captureOriginalTableChildren,
  isPseudoElementClick,
  applyTableView,
} from './utils';
import FilterDropdown from './FilterDropdown';

// CSS class names
const TABLE_CELL_HEADER_CLASS = '.PlaygroundEditorTheme__tableCellHeader';
const SORT_ASC_CLASS = 'sort-asc';
const SORT_DESC_CLASS = 'sort-desc';
const FILTER_ACTIVE_CLASS = 'filter-active';

export default function TableSortFilterPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  const [sortStates, setSortStates] = useState<Map<string, TableSortState>>(
    new Map(),
  );
  const [filterStates, setFilterStates] = useState<
    Map<string, TableFilterState>
  >(new Map());
  const [originalTableChildren, setOriginalTableChildren] = useState<
    Map<string, Map<string, LexicalNode[]>>
  >(new Map());
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<{
    tableKey: string;
    columnIndex: number;
    headerElement: HTMLElement;
  } | null>(null);

  // Handle filter button click (completely independent of sort)
  const handleFilterClick = (
    headerElement: HTMLElement,
    tableElement: HTMLTableElement,
    columnIndex: number,
  ) => {
    // Find the table node and get data
    editor.read(() => {
      // Use Lexical's built-in API to find the table node from DOM element
      const targetTableNode = $getNearestNodeFromDOMNode(tableElement);

      // Ensure it's actually a TableNode
      if (targetTableNode instanceof TableNode) {
        const tableKey = targetTableNode.getKey();

        // Show filter dropdown
        setActiveFilterDropdown({
          tableKey,
          columnIndex,
          headerElement,
        });
      } else {
        console.warn(
          'TableSortFilterPlugin: Could not find TableNode from DOM element',
        );
      }
    });
  };

  // Handle filter change (completely independent of sort)
  const handleFilterChange = (filterValue: string) => {
    if (!activeFilterDropdown) return;

    const {tableKey, columnIndex, headerElement} = activeFilterDropdown;

    // Find table element
    const tableElement = headerElement.closest('table') as HTMLTableElement;
    if (!tableElement) {
      console.warn('TableSortFilterPlugin: Could not find table element');
      return;
    }

    // Update filter state first - single column filter
    const newFilterState = filterValue.trim() 
      ? { columnIndex, filterValue: filterValue.trim() }
      : null;

    setFilterStates((prev) => new Map(prev).set(tableKey, newFilterState));

    editor.update(() => {
      // Use Lexical's built-in API to find the table node from DOM element
      const targetTableNode = $getNearestNodeFromDOMNode(tableElement);

      // Ensure it's actually a TableNode
      if (targetTableNode instanceof TableNode) {
        // Apply unified table view: Original → Sort → Filter
        const currentSortState = sortStates.get(tableKey);
        const originalChildren = originalTableChildren.get(tableKey);
        applyTableView(
          targetTableNode,
          tableElement,
          originalChildren,
          currentSortState,
          newFilterState,
        );
      } else {
        console.warn(
          'TableSortFilterPlugin: Could not find TableNode from DOM element',
        );
      }
    });

    // Update filter visual state (can be done outside editor.update)
    const tableHeaders = Array.from(
      tableElement.querySelectorAll(TABLE_CELL_HEADER_CLASS.slice(1)) || [],
    );

    tableHeaders.forEach((header, index) => {
      header.classList.remove(FILTER_ACTIVE_CLASS);
      if (newFilterState && newFilterState.columnIndex === index) {
        header.classList.add(FILTER_ACTIVE_CLASS);
      }
    });
  };

  // Handle click events on table headers using event delegation on editor container
  useEffect(() => {
    const handleClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      const headerCell = target.closest(TABLE_CELL_HEADER_CLASS);

      if (!headerCell) {
        return;
      }

      // Check if click is in pseudo-element area
      const clickType = isPseudoElementClick(event, headerCell);
      if (!clickType) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      // Find column index
      const row = headerCell.parentElement;
      if (!row) {
        console.warn('TableSortFilterPlugin: Header cell has no parent row');
        return;
      }

      const cells = Array.from(row.children);
      const columnIndex = cells.indexOf(headerCell);

      if (columnIndex === -1) {
        console.warn('TableSortFilterPlugin: Could not find column index');
        return;
      }

      // Find the table element that contains this header
      const tableElement = headerCell.closest('table');
      if (!tableElement) {
        console.warn('TableSortFilterPlugin: Header cell not inside table');
        return;
      }

      if (clickType === 'filter') {
        // Handle filter button click
        handleFilterClick(headerCell as HTMLElement, tableElement, columnIndex);
        return;
      }

      // Handle sort button click (existing sort logic)
      // Close any active filter dropdown before sorting to prevent DOM reference issues
      setActiveFilterDropdown(null);

      editor.update(() => {
        // Use Lexical's built-in API to find the table node from DOM element
        const targetTableNode = $getNearestNodeFromDOMNode(tableElement);

        // Ensure it's actually a TableNode
        if (targetTableNode instanceof TableNode) {
          const tableKey = targetTableNode.getKey();
          const currentSortState = sortStates.get(tableKey);

          // Store original children data if this is the first sort operation for this table
          if (!originalTableChildren.has(tableKey)) {
            const children = $captureOriginalTableChildren(targetTableNode);
            setOriginalTableChildren((prev) =>
              new Map(prev).set(tableKey, children),
            );
          }

          // Determine next state: null → asc → desc → null (cycle)
          let newSortState: TableSortState = null;

          if (
            !currentSortState ||
            currentSortState.columnIndex !== columnIndex
          ) {
            // First click on this column: sort ascending
            newSortState = {columnIndex, direction: 'asc'};
          } else if (currentSortState.direction === 'asc') {
            // Second click: sort descending
            newSortState = {columnIndex, direction: 'desc'};
          } else {
            // Third click: cancel sort
            newSortState = null;
          }

          // Update sort state for this specific table
          if (newSortState) {
            setSortStates((prev) => new Map(prev).set(tableKey, newSortState));
          } else {
            setSortStates((prev) => {
              const newMap = new Map(prev);
              newMap.delete(tableKey);
              return newMap;
            });
          }

          // Apply unified table view: Original → Sort → Filter
          const currentTableFilters = filterStates.get(tableKey);
          const originalChildren = originalTableChildren.get(tableKey);
          applyTableView(
            targetTableNode,
            tableElement,
            originalChildren,
            newSortState,
            currentTableFilters,
          );

          // Update sort visual state
          const thisTableHeaders = tableElement.querySelectorAll(
            TABLE_CELL_HEADER_CLASS,
          );
          thisTableHeaders.forEach((cell) => {
            cell.classList.remove(SORT_ASC_CLASS, SORT_DESC_CLASS);
          });

          if (newSortState) {
            headerCell.classList.add(
              newSortState.direction === 'asc'
                ? SORT_ASC_CLASS
                : SORT_DESC_CLASS,
            );
          }
        } else {
          console.warn(
            'TableSortFilterPlugin: Could not find TableNode from DOM element',
          );
        }
      });
    };

    // Use event delegation: listen on editor container instead of entire document
    // This provides more precise scope and avoids DOM re-rendering issues
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('click', handleClick, true);

      return () => {
        editorElement.removeEventListener('click', handleClick, true);
      };
    }
  }, [editor, sortStates, filterStates, originalTableChildren]);

  return (
    <>
      {activeFilterDropdown && (
        <FilterDropdown
          currentFilter={
            (() => {
              const currentFilterState = filterStates.get(activeFilterDropdown.tableKey);
              return currentFilterState?.columnIndex === activeFilterDropdown.columnIndex 
                ? currentFilterState.filterValue 
                : '';
            })()
          }
          onFilterChange={handleFilterChange}
          onClose={() => setActiveFilterDropdown(null)}
          headerElement={activeFilterDropdown.headerElement}
        />
      )}
    </>
  );
}
