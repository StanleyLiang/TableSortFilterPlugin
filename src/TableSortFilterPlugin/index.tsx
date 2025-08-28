/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, type LexicalNode } from "lexical";
import { useEffect, useState } from "react";
import "./styles.css";
import type { TableSortState } from "./types";
import {
  $captureOriginalTableChildren,
  $getTableCellData,
  $restoreOriginalTableChildren,
  $updateTableDataWithDirectMovement,
  findTableNodeByElement,
  isPseudoElementClick,
  sortTableCellData,
} from "./utils";

// CSS class names
const TABLE_CELL_HEADER_CLASS = ".PlaygroundEditorTheme__tableCellHeader";
const SORT_ASC_CLASS = "sort-asc";
const SORT_DESC_CLASS = "sort-desc";

export default function TableSortFilterPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  const [sortStates, setSortStates] = useState<Map<string, TableSortState>>(
    new Map()
  );
  const [originalTableChildren, setOriginalTableChildren] = useState<
    Map<string, Map<string, LexicalNode[]>>
  >(new Map());

  // Handle click events on table headers using event delegation on editor container
  useEffect(() => {
    const handleClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      const headerCell = target.closest(TABLE_CELL_HEADER_CLASS);

      if (!headerCell) {
        return;
      }

      // Check if click is in pseudo-element area
      if (!isPseudoElementClick(event, headerCell)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      // Find column index
      const row = headerCell.parentElement;
      if (!row) {
        console.warn("TableSortFilterPlugin: Header cell has no parent row");
        return;
      }

      const cells = Array.from(row.children);
      const columnIndex = cells.indexOf(headerCell);

      if (columnIndex === -1) {
        console.warn("TableSortFilterPlugin: Could not find column index");
        return;
      }

      // Find the table element that contains this header
      const tableElement = headerCell.closest("table");
      if (!tableElement) {
        console.warn("TableSortFilterPlugin: Header cell not inside table");
        return;
      }

      // Find and execute sort on the specific table
      editor.update(() => {
        const root = $getRoot();
        const editorElement = editor.getRootElement();
        const allTables = editorElement?.querySelectorAll("table") || [];

        const targetTableNode = findTableNodeByElement(
          root,
          tableElement,
          allTables as NodeListOf<Element>
        );

        if (targetTableNode) {
          const tableKey = targetTableNode.getKey();
          const currentSortState = sortStates.get(tableKey);

          // Store original children data if this is the first sort operation for this table
          if (!originalTableChildren.has(tableKey)) {
            const children = $captureOriginalTableChildren(targetTableNode);
            setOriginalTableChildren((prev) =>
              new Map(prev).set(tableKey, children)
            );
          }

          // Determine next state: null → asc → desc → null (cycle)
          let newSortState: TableSortState = null;

          if (
            !currentSortState ||
            currentSortState.columnIndex !== columnIndex
          ) {
            // First click on this column: sort ascending
            newSortState = { columnIndex, direction: "asc" };
            const data = $getTableCellData(targetTableNode);
            const dataToApply = sortTableCellData(data, columnIndex, "asc");
            $updateTableDataWithDirectMovement(targetTableNode, dataToApply);
          } else if (currentSortState.direction === "asc") {
            // Second click: sort descending
            newSortState = { columnIndex, direction: "desc" };
            const data = $getTableCellData(targetTableNode);
            const dataToApply = sortTableCellData(data, columnIndex, "desc");
            $updateTableDataWithDirectMovement(targetTableNode, dataToApply);
          } else {
            // Third click: cancel sort (restore original data)
            newSortState = null;
            const originalChildren = originalTableChildren.get(tableKey);
            if (originalChildren) {
              $restoreOriginalTableChildren(targetTableNode, originalChildren);
            }
          }

          // Clear sort classes only from this table's headers
          const thisTableHeaders = tableElement.querySelectorAll(
            TABLE_CELL_HEADER_CLASS
          );
          thisTableHeaders.forEach((cell) => {
            cell.classList.remove(SORT_ASC_CLASS, SORT_DESC_CLASS);
          });

          // Add sort class to current cell (if sorting)
          if (newSortState) {
            headerCell.classList.add(
              newSortState.direction === "asc"
                ? SORT_ASC_CLASS
                : SORT_DESC_CLASS
            );
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
        }
      });
    };

    // Use event delegation: listen on editor container instead of entire document
    // This provides more precise scope and avoids DOM re-rendering issues
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener("click", handleClick, true);

      return () => {
        editorElement.removeEventListener("click", handleClick, true);
      };
    }
  }, [editor, sortStates, originalTableChildren]);

  return null;
}
