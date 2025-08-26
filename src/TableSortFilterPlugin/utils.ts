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

// Helper function to create deep copies of cell content before any modifications
function $createCellContentCopy(
  cellNode: TableCellNode,
): SerializedLexicalNode[] {
  const copies: SerializedLexicalNode[] = [];
  const children = cellNode.getChildren();

  children.forEach((child) => {
    try {
      const serialized = child.exportJSON();
      copies.push(serialized);
    } catch (error) {
      // Fallback: create a simple text node representation
      const textContent = child.getTextContent();
      if (textContent) {
        copies.push({
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
  });

  return copies;
}

// Custom function to recreate nodes with proper LinkNode support
function $recreateNodeWithLinkSupport(serializedNode: SerializedLexicalNode): any {
  if (serializedNode.type === 'paragraph') {
    const paragraph = $createParagraphNode();
    
    // Manually handle paragraph children
    if (serializedNode.children && serializedNode.children.length > 0) {
      serializedNode.children.forEach((childSerialized: any) => {
        if (childSerialized.type === 'link') {
          // Create LinkNode manually
          const linkNode = $createLinkNode(childSerialized.url || '#');
          
          // Add text children to the link
          if (childSerialized.children && childSerialized.children.length > 0) {
            childSerialized.children.forEach((linkChildSerialized: any) => {
              if (linkChildSerialized.type === 'text') {
                const textNode = $createTextNode(linkChildSerialized.text || '');
                linkNode.append(textNode);
              }
            });
          } else {
            // Fallback: if no children, create text from the link's content
            const textNode = $createTextNode(childSerialized.text || '');
            linkNode.append(textNode);
          }
          
          paragraph.append(linkNode);
        } else if (childSerialized.type === 'text') {
          const textNode = $createTextNode(childSerialized.text || '');
          paragraph.append(textNode);
        } else {
          // Try standard deserialization for other types
          const recreatedChild = $parseSerializedNode(childSerialized);
          if (recreatedChild) {
            paragraph.append(recreatedChild);
          }
        }
      });
    }
    
    return paragraph;
  } else if (serializedNode.type === 'link') {
    // Direct LinkNode creation
    const linkNode = $createLinkNode(serializedNode.url || '#');
    
    if (serializedNode.children && serializedNode.children.length > 0) {
      serializedNode.children.forEach((childSerialized: any) => {
        if (childSerialized.type === 'text') {
          const textNode = $createTextNode(childSerialized.text || '');
          linkNode.append(textNode);
        }
      });
    }
    
    return linkNode;
  } else {
    // Use standard deserialization for other node types
    return $parseSerializedNode(serializedNode);
  }
}

// Helper function to update table with cell data (uses deep copies for formatting preservation)
export function $updateTableDataWithFormatting(
  tableNode: TableNode,
  data: CellData[][],
): void {
  const rows = tableNode.getChildren();

  // Step 1: Create deep copies of all cell content BEFORE any modifications
  const cellContentCopies: (SerializedLexicalNode[] | null)[][] = [];
  
  data.forEach((rowData, rowIdx) => {
    const rowCopies: (SerializedLexicalNode[] | null)[] = [];
    rowData.forEach((cellData, cellIdx) => {
      
      if (cellData.serializedChildren && cellData.serializedChildren.length > 0) {
        
        // Check for LinkNodes in serialized children
        cellData.serializedChildren.forEach((child, idx) => {
          if (child.type === 'paragraph' && child.children && child.children.length > 0) {
            child.children.forEach((grandChild: any, gIdx: number) => {
              if (grandChild.type === 'link') {
              }
            });
          }
        });
        
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
                
                // Special debug for paragraphs with children
                if (serializedChild.type === 'paragraph' && serializedChild.children && serializedChild.children.length > 0) {
                }
                
                const recreatedChild = $recreateNodeWithLinkSupport(serializedChild);
                
                // Debug the recreated paragraph's children
                if (recreatedChild && recreatedChild.getType() === 'paragraph') {
                  const recreatedChildren = recreatedChild.getChildren();
                }
                
                if (recreatedChild) {
                  targetCell.append(recreatedChild);
                }
              });
            } catch (error) {
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