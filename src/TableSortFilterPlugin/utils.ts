/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { SortDirection } from "./types";

import {
  $isTableCellNode,
  $isTableRowNode,
  TableCellNode,
  TableNode,
} from "@lexical/table";
import {
  $createParagraphNode,
  $createTextNode,
  type LexicalNode,
} from "lexical";
import naturalCompare from "natural-compare";

// Constants for pseudo-element button dimensions
export const BUTTON_RIGHT_OFFSET = 4;
export const BUTTON_WIDTH = 20;
export const BUTTON_HEIGHT = 20;

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
export function $captureOriginalTableChildren(
  tableNode: TableNode
): Map<string, LexicalNode[]> {
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
  data: CellData[][]
): void {
  const rows = tableNode.getChildren();

  // Create a fast lookup map for current cells by cellKey
  const cellKeyToNodeMap = new Map<string, TableCellNode>();
  rows.forEach((row) => {
    if ($isTableRowNode(row)) {
      const cells = row.getChildren();
      cells.forEach((cell) => {
        if ($isTableCellNode(cell)) {
          cellKeyToNodeMap.set(cell.getKey(), cell);
        }
      });
    }
  });

  // Step 1: Collect all content that needs to be moved (before any modifications)
  const contentToMove: {
    targetCell: TableCellNode;
    content: LexicalNode[] | string;
  }[][] = [];

  data.forEach((rowData, rowIndex) => {
    const rowContentToMove: {
      targetCell: TableCellNode;
      content: LexicalNode[] | string;
    }[] = [];

    if (rowIndex < rows.length && $isTableRowNode(rows[rowIndex])) {
      const row = rows[rowIndex];
      const cells = row.getChildren();

      rowData.forEach((cellData, cellIndex) => {
        if (cellIndex < cells.length && $isTableCellNode(cells[cellIndex])) {
          const targetCell = cells[cellIndex];

          if (cellData.cellKey !== targetCell.getKey()) {
            // Content needs to be updated - find source cell by unique key (O(1) lookup)
            const sourceCell = cellKeyToNodeMap.get(cellData.cellKey);

            if (sourceCell) {
              // Collect children from found source cell
              const children = sourceCell.getChildren().slice();
              rowContentToMove.push({ targetCell, content: children });
            } else if (cellData.textContent.trim()) {
              // Text-only content - create new
              rowContentToMove.push({
                targetCell,
                content: cellData.textContent,
              });
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
      } else if (typeof content === "string" && content.trim()) {
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
  direction: SortDirection
): CellData[][] {
  const headerRow = data[0];
  const dataRows = data.slice(1);

  const sortedRows = [...dataRows].sort((a, b) => {
    const aVal = a[columnIndex]?.textContent || "";
    const bVal = b[columnIndex]?.textContent || "";

    // Check if values are empty (after trimming)
    const aIsEmpty = aVal.trim().length === 0;
    const bIsEmpty = bVal.trim().length === 0;

    // Both empty - maintain original order
    if (aIsEmpty && bIsEmpty) {
      return 0;
    }

    // One is empty - empty goes to end regardless of sort direction
    if (aIsEmpty) return 1; // a goes after b
    if (bIsEmpty) return -1; // b goes after a

    // Both have content - use natural-compare for intelligent sorting
    const comparison = naturalCompare(aVal, bVal);
    return direction === "asc" ? comparison : -comparison;
  });

  return [headerRow, ...sortedRows];
}

// Check if header cell has pseudo-element (::after)
export function hasPseudoElement(headerCell: Element): boolean {
  // Use getComputedStyle to check ::after pseudo-element
  const pseudoStyle = window.getComputedStyle(headerCell, "::after");

  // Check if content property is not 'none' or empty string
  const content = pseudoStyle.getPropertyValue("content");

  // CSS content values 'none' or '""' indicate no content
  return content !== "none" && content !== '""' && content !== "";
}

// Precisely detect if click is in pseudo-element button area
export function isPseudoElementClick(
  event: MouseEvent,
  headerCell: Element
): boolean {
  // First check if there really is a pseudo-element
  if (!hasPseudoElement(headerCell)) {
    return false;
  }

  // Use offsetX/offsetY (simpler and better performance)
  const offsetX = event.offsetX;
  const offsetY = event.offsetY;
  const rect = headerCell.getBoundingClientRect();

  // Calculate based on actual button position in CSS
  const buttonLeft = rect.width - BUTTON_RIGHT_OFFSET - BUTTON_WIDTH;
  const buttonTop = (rect.height - BUTTON_HEIGHT) / 2;

  return (
    offsetX >= buttonLeft &&
    offsetX <= rect.width - BUTTON_RIGHT_OFFSET &&
    offsetY >= buttonTop &&
    offsetY <= buttonTop + BUTTON_HEIGHT
  );
}

// Helper function to find table node by DOM element
export function findTableNodeByElement(
  root: LexicalNode,
  targetElement: HTMLTableElement,
  allTables: NodeListOf<Element>
): TableNode | null {
  let targetTableNode: TableNode | null = null;
  let tableIndex = -1;

  function traverse(node: LexicalNode): boolean {
    if (node.getType() === "table") {
      tableIndex++;
      if (allTables[tableIndex] === targetElement) {
        targetTableNode = node as TableNode;
        return true; // Found - stop searching
      }
    }

    const children = node.getChildren();
    for (const child of children) {
      if (traverse(child)) {
        return true; // Early exit when found
      }
    }

    return false; // Not found in this branch
  }

  traverse(root);
  return targetTableNode;
}
