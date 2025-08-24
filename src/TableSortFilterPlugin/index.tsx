/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {useLexicalEditable} from '@lexical/react/useLexicalEditable';
import {
  $findTableNode,
  $isTableSelection,
  TableNode,
} from '@lexical/table';
import {
  $getRoot,
  $getSelection,
  COMMAND_PRIORITY_EDITOR,
} from 'lexical';
import {useEffect, useState} from 'react';

import {
  CLEAR_TABLE_FILTERS_COMMAND,
  FILTER_TABLE_COLUMN_COMMAND,
  SORT_TABLE_COLUMN_COMMAND,
} from './commands';
import './styles.css';
import type {SortDirection, TableFilterState, TableSortState} from './types';
import {
  $getTableData,
  $updateTableData,
  filterTableData,
  sortTableData,
} from './utils';

// Re-export commands for external use
export {
  CLEAR_TABLE_FILTERS_COMMAND,
  FILTER_TABLE_COLUMN_COMMAND,
  SORT_TABLE_COLUMN_COMMAND,
};


export default function TableSortFilterPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();

  const [sortStates, setSortStates] = useState<Map<string, TableSortState>>(new Map());
  const [filterState, setFilterState] = useState<TableFilterState>({});

  useEffect(() => {
    if (!isEditable) {
      return;
    }

    // Register sort command
    const removeSortCommand = editor.registerCommand(
      SORT_TABLE_COLUMN_COMMAND,
      ({columnIndex, direction}) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isTableSelection(selection)) {
            const tableNode = $findTableNode(selection.anchor.getNode());
            if (tableNode) {
              const data = $getTableData(tableNode);
              const sortedData = sortTableData(data, columnIndex, direction);
              $updateTableData(tableNode, sortedData);
              // Update sort state for this specific table
              const tableKey = tableNode.getKey();
              setSortStates(prev => new Map(prev).set(tableKey, {columnIndex, direction}));
            }
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Register filter command
    const removeFilterCommand = editor.registerCommand(
      FILTER_TABLE_COLUMN_COMMAND,
      ({columnIndex, filterValue}) => {
        setFilterState((prev) => {
          const newFilters = {...prev};
          if (filterValue.trim() === '') {
            delete newFilters[columnIndex];
          } else {
            newFilters[columnIndex] = filterValue;
          }

          // Apply filters
          editor.update(() => {
            const selection = $getSelection();
            if ($isTableSelection(selection)) {
              const tableNode = $findTableNode(selection.anchor.getNode());
              if (tableNode) {
                const data = $getTableData(tableNode);
                const filteredData = filterTableData(data, newFilters);
                $updateTableData(tableNode, filteredData);
              }
            }
          });

          return newFilters;
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Register clear filters command
    const removeClearCommand = editor.registerCommand(
      CLEAR_TABLE_FILTERS_COMMAND,
      () => {
        setFilterState({});
        setSortStates(new Map());

        // TODO: Restore original table data
        // This would require storing the original data when filters are first applied

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    return () => {
      removeSortCommand();
      removeFilterCommand();
      removeClearCommand();
    };
  }, [editor, isEditable]);



  // Handle click events on table headers
  useEffect(() => {
    if (!isEditable) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const headerCell = target.closest('.PlaygroundEditorTheme__tableCellHeader');
      
      if (!headerCell) return;
      
      // Check if click is on the pseudo-element (sort button area)
      const rect = headerCell.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      
      // Rough detection: if click is in the right portion of the cell
      if (clickX > rect.width - 30) {
        event.preventDefault();
        event.stopPropagation();
        
        // Find column index
        const row = headerCell.parentElement;
        if (!row) return;
        
        const cells = Array.from(row.children);
        const columnIndex = cells.indexOf(headerCell);
        
        if (columnIndex === -1) return;
        
        // Find the table element that contains this header
        const tableElement = headerCell.closest('table');
        if (!tableElement) return;
        
        // Find and execute sort on the specific table
        editor.update(() => {
          const root = $getRoot();
          let targetTableNode: TableNode | null = null;
          let tableIndex = -1;
          
          function traverse(node: any) {
            if (node.getType && node.getType() === 'table') {
              tableIndex++;
              
              // Match DOM table with Lexical table node by index
              const allTables = document.querySelectorAll('table');
              if (allTables[tableIndex] === tableElement) {
                targetTableNode = node as TableNode;
                return;
              }
            }
            if (node.getChildren) {
              const children = node.getChildren();
              children.forEach((child: any) => traverse(child));
            }
          }
          
          traverse(root);
          
          if (targetTableNode) {
            const tableKey = targetTableNode.getKey();
            const currentSortState = sortStates.get(tableKey);
            
            // Determine sort direction based on this table's current state
            let direction: SortDirection = 'asc';
            if (currentSortState && currentSortState.columnIndex === columnIndex) {
              direction = currentSortState.direction === 'asc' ? 'desc' : 'asc';
            }
            
            // Clear sort classes only from this table's headers
            const thisTableHeaders = tableElement.querySelectorAll('.PlaygroundEditorTheme__tableCellHeader');
            thisTableHeaders.forEach(cell => {
              cell.classList.remove('sort-asc', 'sort-desc');
            });
            
            // Add sort class to current cell
            headerCell.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
            
            // Execute sort
            const data = $getTableData(targetTableNode);
            const sortedData = sortTableData(data, columnIndex, direction);
            $updateTableData(targetTableNode, sortedData);
            
            // Update sort state for this specific table
            setSortStates(prev => new Map(prev).set(tableKey, {columnIndex, direction}));
          }
        });
      }
    };

    document.addEventListener('click', handleClick, true);
    
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [editor, isEditable, sortStates]);

  return null;
}