/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {$isTableCellNode, $isTableRowNode, TableCellNode, TableNode} from '@lexical/table';
import {
  $createParagraphNode, 
  $createTextNode, 
  $parseSerializedNode,
  SerializedLexicalNode,
  LexicalNode,
  $getEditor,
  LexicalEditor
} from 'lexical';
import naturalCompare from 'natural-compare';

import type {SortDirection, TableFilterState} from './types';

// Type for storing cell content with formatting
export interface CellData {
  textContent: string;
  cellNode: TableCellNode;
  serializedChildren: SerializedLexicalNode[];
}

// Helper function to get table data for sorting - returns both text and cell nodes
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
          
          // Serialize all children to preserve formatting
          const serializedChildren: SerializedLexicalNode[] = [];
          const children = cell.getChildren();
          
          children.forEach((child) => {
            const childText = child.getTextContent();
            const childType = child.getType();
            
            try {
              const serialized = child.exportJSON();
              
              // Check if this is a paragraph with text content but empty children
              if (childType === 'paragraph' && childText && (!serialized.children || serialized.children.length === 0)) {
                // Manually serialize the actual children of the paragraph
                const actualChildren = child.getChildren();
                
                const manualChildren: any[] = [];
                actualChildren.forEach((textChild) => {
                  const textContent = textChild.getTextContent();
                  
                  try {
                    const textSerialized = textChild.exportJSON();
                    manualChildren.push(textSerialized);
                  } catch (error) {
                    console.warn('Failed to serialize text child:', error);
                    // Fallback
                    manualChildren.push({
                      type: 'text',
                      version: 1,
                      text: textContent,
                      format: 0,
                      style: '',
                      mode: 'normal',
                      detail: 0
                    });
                  }
                });
                
                const manualSerialized = {
                  ...serialized,
                  children: manualChildren
                };
                serializedChildren.push(manualSerialized);
              } else {
                serializedChildren.push(serialized);
              }
            } catch (error) {
              console.warn('Failed to serialize child node:', error);
              // Fallback: create a simple text node representation
              const textContent = child.getTextContent();
              if (textContent) {
                serializedChildren.push({
                  type: 'paragraph',
                  version: 1,
                  children: [{
                    type: 'text',
                    version: 1,
                    text: textContent,
                    format: 0,
                    style: '',
                    mode: 'normal',
                    detail: 0
                  }]
                });
              }
            }
          });
          
          rowData.push({
            textContent: cellText,
            cellNode: cell,
            serializedChildren
          });
        }
      });

      data.push(rowData);
    }
  });

  return data;
}

// Helper function to update table with new data (preserves text only)
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

// Test different methods of copying cell children
export function $testCellNodeCopy(sourceCell: TableCellNode, targetCell: TableCellNode): boolean {
  console.log('=== Testing Cell Node Copy Methods ===');
  
  // Method 1: Direct clone() method
  console.log('Method 1: Testing direct clone()');
  try {
    targetCell.clear();
    const sourceChildren = sourceCell.getChildren();
    console.log(`Source has ${sourceChildren.length} children`);
    
    sourceChildren.forEach((child, index) => {
      console.log(`Child ${index}: type=${child.getType()}, text="${child.getTextContent()}"`);
      const cloned = child.clone();
      console.log(`Cloned child ${index}: type=${cloned.getType()}, text="${cloned.getTextContent()}"`);
      targetCell.append(cloned);
    });
    
    const targetChildren = targetCell.getChildren();
    console.log(`Target now has ${targetChildren.length} children`);
    console.log(`Target text content: "${targetCell.getTextContent()}"`);
    
    return targetCell.getTextContent().trim().length > 0;
  } catch (error) {
    console.error('Method 1 failed:', error);
    return false;
  }
}

// Method 2: Using exportJSON and importJSON
export function $testCellNodeCopyJSON(sourceCell: TableCellNode, targetCell: TableCellNode): boolean {
  console.log('Method 2: Testing JSON serialization');
  try {
    targetCell.clear();
    const sourceChildren = sourceCell.getChildren();
    
    sourceChildren.forEach((child, index) => {
      const childJSON = child.exportJSON();
      console.log(`Child ${index} JSON:`, childJSON);
      
      const recreatedChild = $parseSerializedNode(childJSON);
      if (recreatedChild) {
        console.log(`Recreated child ${index}: type=${recreatedChild.getType()}, text="${recreatedChild.getTextContent()}"`);
        targetCell.append(recreatedChild);
      }
    });
    
    console.log(`Target text content: "${targetCell.getTextContent()}"`);
    return targetCell.getTextContent().trim().length > 0;
  } catch (error) {
    console.error('Method 2 failed:', error);
    return false;
  }
}

// Method 3: Manual recreation based on node types
export function $testCellNodeCopyManual(sourceCell: TableCellNode, targetCell: TableCellNode): boolean {
  console.log('Method 3: Testing manual recreation');
  try {
    targetCell.clear();
    const sourceChildren = sourceCell.getChildren();
    
    sourceChildren.forEach((child, index) => {
      const childType = child.getType();
      const childText = child.getTextContent();
      
      console.log(`Processing child ${index}: type=${childType}, text="${childText}"`);
      
      if (childType === 'paragraph') {
        const newParagraph = $createParagraphNode();
        const newText = $createTextNode(childText);
        newParagraph.append(newText);
        targetCell.append(newParagraph);
        console.log(`Created paragraph with text: "${childText}"`);
      } else if (childType === 'text') {
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode(childText);
        paragraph.append(textNode);
        targetCell.append(paragraph);
        console.log(`Created text node with text: "${childText}"`);
      } else {
        console.log(`Unknown child type: ${childType}, falling back to text`);
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode(childText);
        paragraph.append(textNode);
        targetCell.append(paragraph);
      }
    });
    
    console.log(`Target text content: "${targetCell.getTextContent()}"`);
    return targetCell.getTextContent().trim().length > 0;
  } catch (error) {
    console.error('Method 3 failed:', error);
    return false;
  }
}

// Main function to test all methods
export function $runCellCopyTests(sourceCell: TableCellNode, targetCell: TableCellNode): void {
  console.log('Starting cell copy tests...');
  console.log(`Source cell content: "${sourceCell.getTextContent()}"`);
  
  const method1Success = $testCellNodeCopy(sourceCell, targetCell);
  console.log(`Method 1 (clone): ${method1Success ? 'SUCCESS' : 'FAILED'}`);
  
  const method2Success = $testCellNodeCopyJSON(sourceCell, targetCell);
  console.log(`Method 2 (JSON): ${method2Success ? 'SUCCESS' : 'FAILED'}`);
  
  const method3Success = $testCellNodeCopyManual(sourceCell, targetCell);
  console.log(`Method 3 (manual): ${method3Success ? 'SUCCESS' : 'FAILED'}`);
  
  console.log('=== Test Results ===');
  console.log(`Method 1: ${method1Success ? 'PASS' : 'FAIL'}`);
  console.log(`Method 2: ${method2Success ? 'PASS' : 'FAIL'}`);
  console.log(`Method 3: ${method3Success ? 'PASS' : 'FAIL'}`);
}

// Helper function to create deep copies of cell content before any modifications
function $createCellContentCopy(cellNode: TableCellNode): SerializedLexicalNode[] {
  const copies: SerializedLexicalNode[] = [];
  const children = cellNode.getChildren();
  
  children.forEach(child => {
    try {
      const serialized = child.exportJSON();
      copies.push(serialized);
    } catch (error) {
      console.warn('Failed to serialize child node for copy:', error);
      // Fallback: create a simple text node representation
      const textContent = child.getTextContent();
      if (textContent) {
        copies.push({
          type: 'paragraph',
          version: 1,
          children: [{
            type: 'text',
            version: 1,
            text: textContent,
            format: 0,
            style: '',
            mode: 'normal',
            detail: 0
          }]
        });
      }
    }
  });
  
  return copies;
}

// Helper function to update table with cell data (uses deep copies for formatting preservation)
export function $updateTableDataWithFormatting(tableNode: TableNode, data: CellData[][]): void {
  const rows = tableNode.getChildren();

  // Step 1: Create deep copies of all cell content BEFORE any modifications
  const cellContentCopies: (SerializedLexicalNode[] | null)[][] = [];
  
  data.forEach((rowData) => {
    const rowCopies: (SerializedLexicalNode[] | null)[] = [];
    rowData.forEach((cellData) => {
      if (cellData.serializedChildren && cellData.serializedChildren.length > 0) {
        // Use pre-serialized data if available
        rowCopies.push([...cellData.serializedChildren]);
      } else if (cellData.cellNode && cellData.cellNode.getChildren().length > 0) {
        // Create fresh copy from live node
        const copies = $createCellContentCopy(cellData.cellNode);
        rowCopies.push(copies);
      } else {
        // No formatting to preserve, just text
        rowCopies.push(null);
      }
    });
    cellContentCopies.push(rowCopies);
  });

  // Step 2: Now safely apply the copies to target cells
  data.forEach((rowData, rowIndex) => {
    if (rowIndex < rows.length && $isTableRowNode(rows[rowIndex])) {
      const row = rows[rowIndex];
      const cells = row.getChildren();

      rowData.forEach((cellData, cellIndex) => {
        if (cellIndex < cells.length && $isTableCellNode(cells[cellIndex])) {
          const targetCell = cells[cellIndex];
          const cellCopies = cellContentCopies[rowIndex]?.[cellIndex];
          
          // Clear the target cell first
          targetCell.clear();
          
          if (cellCopies && cellCopies.length > 0) {
            // Apply formatting from deep copies
            try {
              cellCopies.forEach((serializedChild) => {
                const recreatedChild = $parseSerializedNode(serializedChild);
                if (recreatedChild) {
                  targetCell.append(recreatedChild);
                }
              });
            } catch (error) {
              console.error('Error applying formatted content:', error);
              // Fallback to text-only
              if (cellData.textContent.trim()) {
                const paragraph = $createParagraphNode();
                const textNode = $createTextNode(cellData.textContent);
                paragraph.append(textNode);
                targetCell.append(paragraph);
              }
            }
          } else if (cellData.textContent.trim()) {
            // No formatting, just apply text
            const paragraph = $createParagraphNode();
            const textNode = $createTextNode(cellData.textContent);
            paragraph.append(textNode);
            targetCell.append(paragraph);
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
      const cellValue = row[parseInt(columnIndex, 10)] || '';
      return cellValue.toLowerCase().includes(filterValue.toLowerCase());
    });
  });

  return [headerRow, ...filteredRows];
}