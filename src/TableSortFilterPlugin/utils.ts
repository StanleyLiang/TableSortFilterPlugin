/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {SortDirection, TableFilterState} from './types';

import {
  $isTableCellNode,
  $isTableRowNode,
  TableCellNode,
  TableNode,
} from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
} from 'lexical';
import naturalCompare from 'natural-compare';

// Type for storing cell content with formatting
export interface CellData {
  textContent: string;
  cellNode: TableCellNode;
  cellKey: string; // Unique identifier for each cell
}


// Helper function to get table data with full cell nodes for preserving formatting
export function $getTableCellData(tableNode: TableNode): CellData[][] {
  const data: CellData[][] = [];
  const rows = tableNode.getChildren();

  rows.forEach((row) => {
    if ($isTableRowNode(row)) {
      const rowData: CellData[] = [];
      const cells = row.getChildren();

      cells.forEach((cell) => {
        if ($isTableCellNode(cell)) {
          const cellText = cell.getTextContent();
          const cellKey = cell.getKey(); // Use Lexical's unique key

          rowData.push({
            cellNode: cell,
            textContent: cellText,
            cellKey: cellKey,
          });
        }
      });

      data.push(rowData);
    }
  });

  return data;
}

// Function to capture original children data by position
export function $captureOriginalTableChildren(tableNode: TableNode): Map<string, LexicalNode[]> {
  const originalChildren = new Map<string, LexicalNode[]>();
  const rows = tableNode.getChildren();

  rows.forEach((row, rowIndex) => {
    if ($isTableRowNode(row)) {
      const cells = row.getChildren();
      cells.forEach((cell, cellIndex) => {
        if ($isTableCellNode(cell)) {
          const key = `${rowIndex}-${cellIndex}`;
          const children = cell.getChildren().slice(); // Create a copy
          originalChildren.set(key, children);
        }
      });
    }
  });

  return originalChildren;
}

// Function to restore original children data by position
export function $restoreOriginalTableChildren(
  tableNode: TableNode,
  originalChildren: Map<string, LexicalNode[]>
): void {
  const rows = tableNode.getChildren();

  rows.forEach((row, rowIndex) => {
    if ($isTableRowNode(row)) {
      const cells = row.getChildren();
      cells.forEach((cell, cellIndex) => {
        if ($isTableCellNode(cell)) {
          const key = `${rowIndex}-${cellIndex}`;
          const children = originalChildren.get(key);
          if (children) {
            cell.clear();
            children.forEach((child) => {
              cell.append(child);
            });
          }
        }
      });
    }
  });
}

// Safe node movement by collecting content first, then applying
export function $updateTableDataWithDirectMovement(
  tableNode: TableNode,
  data: CellData[][],
): void {
  const rows = tableNode.getChildren();

  // Get current table state fresh (not from cached cellNode references)
  const currentTableData = $getTableCellData(tableNode);

  // Step 1: Collect all content that needs to be moved (before any modifications)
  const contentToMove: { targetCell: TableCellNode; content: LexicalNode[] | string }[][] = [];
  
  data.forEach((rowData, rowIndex) => {
    const rowContentToMove: { targetCell: TableCellNode; content: LexicalNode[] | string }[] = [];
    
    if (rowIndex < rows.length && $isTableRowNode(rows[rowIndex])) {
      const row = rows[rowIndex];
      const cells = row.getChildren();

      rowData.forEach((cellData, cellIndex) => {
        if (cellIndex < cells.length && $isTableCellNode(cells[cellIndex])) {
          const targetCell = cells[cellIndex];
          
          if (cellData.cellKey !== targetCell.getKey()) {
            // Content needs to be updated - find source cell by unique key
            let sourceCell: TableCellNode | null = null;
            
            // Search through all current cells to find the one with matching cellKey
            for (let searchRowIndex = 0; searchRowIndex < currentTableData.length; searchRowIndex++) {
              for (let searchCellIndex = 0; searchCellIndex < currentTableData[searchRowIndex].length; searchCellIndex++) {
                const searchCellData = currentTableData[searchRowIndex][searchCellIndex];
                if (searchCellData.cellKey === cellData.cellKey) {
                  sourceCell = searchCellData.cellNode;
                  break;
                }
              }
              if (sourceCell) break;
            }
            
            if (sourceCell) {
              // Collect children from found source cell
              const children = sourceCell.getChildren().slice();
              rowContentToMove.push({ targetCell, content: children });
            } else if (cellData.textContent.trim()) {
              // Text-only content - create new
              rowContentToMove.push({ targetCell, content: cellData.textContent });
            } else {
              // No change needed
              rowContentToMove.push({ targetCell, content: [] });
            }
          } else {
            // No change needed
            rowContentToMove.push({ targetCell, content: [] });
          }
        }
      });
    }
    contentToMove.push(rowContentToMove);
  });

  // Step 2: Apply the collected content (safe from interference)
  contentToMove.forEach((rowContentToMove) => {
    rowContentToMove.forEach((cellContentToMove) => {
      const { targetCell, content } = cellContentToMove;
      
      if (Array.isArray(content) && content.length > 0) {
        // Move nodes
        targetCell.clear();
        content.forEach((child) => {
          targetCell.append(child);
        });
      } else if (typeof content === 'string' && content.trim()) {
        // Create text content
        targetCell.clear();
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode(content);
        paragraph.append(textNode);
        targetCell.append(paragraph);
      }
      // No action needed for empty content or same position
    });
  });
}


// Sort function for cell data with formatting preservation
export function sortTableCellData(
  data: CellData[][],
  columnIndex: number,
  direction: SortDirection,
): CellData[][] {
  const headerRow = data[0];
  const dataRows = data.slice(1);

  const sortedRows = [...dataRows].sort((a, b) => {
    const aVal = a[columnIndex]?.textContent || '';
    const bVal = b[columnIndex]?.textContent || '';

    // Use natural-compare for intelligent sorting of mixed content
    const comparison = naturalCompare(aVal, bVal);
    return direction === 'asc' ? comparison : -comparison;
  });

  return [headerRow, ...sortedRows];
}