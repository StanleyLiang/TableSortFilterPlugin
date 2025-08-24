/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {$isTableCellNode, $isTableRowNode, TableNode} from '@lexical/table';
import {$createParagraphNode, $createTextNode} from 'lexical';
import naturalCompare from 'natural-compare';

import type {SortDirection, TableFilterState} from './types';

// Helper function to get table data for sorting/filtering
export function $getTableData(tableNode: TableNode): string[][] {
  const data: string[][] = [];
  const rows = tableNode.getChildren();

  rows.forEach((row) => {
    if ($isTableRowNode(row)) {
      const rowData: string[] = [];
      const cells = row.getChildren();

      cells.forEach((cell) => {
        if ($isTableCellNode(cell)) {
          const cellText = cell.getTextContent();
          rowData.push(cellText);
        }
      });

      data.push(rowData);
    }
  });

  return data;
}

// Helper function to update table with new data
export function $updateTableData(tableNode: TableNode, data: string[][]): void {
  const rows = tableNode.getChildren();

  data.forEach((rowData, rowIndex) => {
    if (rowIndex < rows.length && $isTableRowNode(rows[rowIndex])) {
      const row = rows[rowIndex];
      const cells = row.getChildren();

      rowData.forEach((cellText, cellIndex) => {
        if (cellIndex < cells.length && $isTableCellNode(cells[cellIndex])) {
          const cell = cells[cellIndex];
          cell.clear();
          if (cellText.trim()) {
            const paragraph = $createParagraphNode();
            const textNode = $createTextNode(cellText);
            paragraph.append(textNode);
            cell.append(paragraph);
          }
        }
      });
    }
  });
}

// Sort function with natural comparison for mixed content
export function sortTableData(
  data: string[][],
  columnIndex: number,
  direction: SortDirection,
): string[][] {
  const headerRow = data[0];
  const dataRows = data.slice(1);

  const sortedRows = [...dataRows].sort((a, b) => {
    const aVal = a[columnIndex] || '';
    const bVal = b[columnIndex] || '';

    // Use natural-compare for intelligent sorting of mixed content
    // This handles numbers, strings, and mixed alphanumeric content correctly
    // Examples: 
    // - "item2" vs "item10" → "item2", "item10" (not "item10", "item2")
    // - "1.5" vs "10.2" → "1.5", "10.2" (numeric comparison)
    // - "abc" vs "def" → "abc", "def" (alphabetic comparison)
    const comparison = naturalCompare(aVal, bVal);
    return direction === 'asc' ? comparison : -comparison;
  });

  return [headerRow, ...sortedRows];
}

// Filter function
export function filterTableData(
  data: string[][],
  filters: TableFilterState,
): string[][] {
  if (Object.keys(filters).length === 0) {
    return data;
  }

  const headerRow = data[0];
  const dataRows = data.slice(1);

  const filteredRows = dataRows.filter((row) => {
    return Object.entries(filters).every(([columnIndex, filterValue]) => {
      const cellValue = row[parseInt(columnIndex)] || '';
      return cellValue.toLowerCase().includes(filterValue.toLowerCase());
    });
  });

  return [headerRow, ...filteredRows];
}