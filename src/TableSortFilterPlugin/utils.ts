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
import {$isLinkNode, $createLinkNode} from '@lexical/link';
import {
  $createParagraphNode,
  $createTextNode,
  $parseSerializedNode,
  SerializedLexicalNode,
} from 'lexical';
import naturalCompare from 'natural-compare';

// Type for storing cell content with formatting
export interface CellData {
  textContent: string;
  cellNode: TableCellNode;
  serializedChildren: SerializedLexicalNode[];
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

              // Check if this is a paragraph - always manually serialize children to preserve LinkNodes
              if (childType === 'paragraph') {
                // Always manually serialize the actual children of the paragraph to ensure LinkNodes are preserved
                const actualChildren = child.getChildren();

                const manualChildren: SerializedLexicalNode[] = [];
                actualChildren.forEach((paragraphChild) => {
                  const childContent = paragraphChild.getTextContent();
                  const childType = paragraphChild.getType();

                  try {
                    const childSerialized = paragraphChild.exportJSON();
                    
                    // Special handling for LinkNode to ensure children are serialized
                    if (childType === 'link') {
                      // Manual serialization of LinkNode children if they're missing
                      if (!childSerialized.children || childSerialized.children.length === 0) {
                        const linkChildren: SerializedLexicalNode[] = [];
                        const linkNodeChildren = paragraphChild.getChildren();
                        
                        linkNodeChildren.forEach((linkChild) => {
                          try {
                            const linkChildSerialized = linkChild.exportJSON();
                            linkChildren.push(linkChildSerialized);
                          } catch (error) {
                            linkChildren.push({
                              detail: 0,
                              format: 0,
                              mode: 'normal',
                              style: '',
                              text: linkChild.getTextContent(),
                              type: 'text',
                              version: 1,
                            });
                          }
                        });
                        
                        // Update the serialized LinkNode with manually serialized children
                        childSerialized.children = linkChildren;
                      }
                    }
                    
                    manualChildren.push(childSerialized);
                  } catch (error) {
                    
                    // Enhanced fallback for different node types
                    if (childType === 'link') {
                      // Special handling for LinkNode fallback
                      const url = (paragraphChild as any).getURL?.() || '#';
                      manualChildren.push({
                        children: [
                          {
                            detail: 0,
                            format: 0,
                            mode: 'normal',
                            style: '',
                            text: childContent,
                            type: 'text',
                            version: 1,
                          },
                        ],
                        rel: 'noopener noreferrer',
                        target: null,
                        title: null,
                        type: 'link',
                        url: url,
                        version: 1,
                      });
                    } else {
                      // Standard text fallback
                      manualChildren.push({
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text: childContent,
                        type: 'text',
                        version: 1,
                      });
                    }
                  }
                });

                const manualSerialized = {
                  ...serialized,
                  children: manualChildren,
                };
                serializedChildren.push(manualSerialized);
              }
              // Check if this is a link node with text content but empty children
              else if (
                childType === 'link' &&
                childText &&
                (!serialized.children || serialized.children.length === 0)
              ) {
                // Manually serialize the actual children of the link node
                const actualChildren = child.getChildren();

                const manualChildren: SerializedLexicalNode[] = [];
                actualChildren.forEach((linkChild) => {
                  const linkChildContent = linkChild.getTextContent();

                  try {
                    const linkChildSerialized = linkChild.exportJSON();
                    manualChildren.push(linkChildSerialized);
                  } catch (error) {
                    // Fallback for link children
                    manualChildren.push({
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      text: linkChildContent,
                      type: 'text',
                      version: 1,
                    });
                  }
                });

                const manualSerialized = {
                  ...serialized,
                  children: manualChildren,
                };
                serializedChildren.push(manualSerialized);
              } else {
                serializedChildren.push(serialized);
              }
            } catch (error) {
              // Enhanced fallback: try to preserve link information if it's a LinkNode
              const textContent = child.getTextContent();
              if (textContent) {
                if (childType === 'link') {
                  // Try to preserve link as much as possible
                  try {
                    // Check if we can get URL from the node
                    const linkNode = child;
                    const url = (linkNode as any).getURL?.() || '#';
                    
                    serializedChildren.push({
                      children: [
                        {
                          detail: 0,
                          format: 0,
                          mode: 'normal',
                          style: '',
                          text: textContent,
                          type: 'text',
                          version: 1,
                        },
                      ],
                      rel: 'noopener noreferrer',
                      target: null,
                      title: null,
                      type: 'link',
                      url: url,
                      version: 1,
                    });
                  } catch (linkError) {
                    // If link fallback fails, use paragraph fallback
                    serializedChildren.push({
                      children: [
                        {
                          detail: 0,
                          format: 0,
                          mode: 'normal',
                          style: '',
                          text: textContent,
                          type: 'text',
                          version: 1,
                        },
                      ],
                      type: 'paragraph',
                      version: 1,
                    });
                  }
                } else {
                  // Standard fallback for non-link nodes
                  serializedChildren.push({
                    children: [
                      {
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text: textContent,
                        type: 'text',
                        version: 1,
                      },
                    ],
                    type: 'paragraph',
                    version: 1,
                  });
                }
              }
            }
          });

          rowData.push({
            cellNode: cell,
            serializedChildren,
            textContent: cellText,
          });
        }
      });

      data.push(rowData);
    }
  });

  return data;
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
          
          if (cellData.textContent !== targetCell.getTextContent()) {
            // Content needs to be updated - find source cell by text content
            let sourceCell: TableCellNode | null = null;
            
            // Search through all current cells to find the one with matching content
            for (let searchRowIndex = 0; searchRowIndex < currentTableData.length; searchRowIndex++) {
              for (let searchCellIndex = 0; searchCellIndex < currentTableData[searchRowIndex].length; searchCellIndex++) {
                const searchCellData = currentTableData[searchRowIndex][searchCellIndex];
                if (searchCellData.textContent === cellData.textContent && searchCellData.cellNode) {
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