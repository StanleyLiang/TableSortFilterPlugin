/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TableNode } from "@lexical/table";
import { $getRoot } from "lexical";
import { useEffect, useState } from "react";
import "./styles.css";
import type { TableSortState } from "./types";
import {
  $captureOriginalTableChildren,
  $getTableCellData,
  $restoreOriginalTableChildren,
  $updateTableDataWithDirectMovement,
  type CellData,
  sortTableCellData,
} from "./utils";

// 檢查 header cell 是否有 pseudo-element (::after)
function hasPseudoElement(headerCell: Element): boolean {
  // 使用 getComputedStyle 檢查 ::after pseudo-element
  const pseudoStyle = window.getComputedStyle(headerCell, "::after");

  // 檢查 content 屬性是否不是 'none' 或空字符串
  const content = pseudoStyle.getPropertyValue("content");

  // CSS content 值 'none' 或 '""' 表示沒有內容
  return content !== "none" && content !== '""' && content !== "";
}

// 精確檢測是否點擊在 pseudo-element 按鈕區域
function isPseudoElementClick(event: MouseEvent, headerCell: Element): boolean {
  // 首先檢查是否真的有 pseudo-element
  if (!hasPseudoElement(headerCell)) {
    return false;
  }

  // 使用 offsetX/offsetY (更簡單、性能更好)
  const offsetX = event.offsetX;
  const offsetY = event.offsetY;
  const rect = headerCell.getBoundingClientRect();

  // 基於 CSS 中的實際按鈕位置計算
  // right: 4px, padding: 2px 4px, 大約 20px 寬度
  const buttonRightOffset = 4;
  const buttonWidth = 20;
  const buttonHeight = 20;

  const buttonLeft = rect.width - buttonRightOffset - buttonWidth;
  const buttonTop = (rect.height - buttonHeight) / 2;

  return (
    offsetX >= buttonLeft &&
    offsetX <= rect.width - buttonRightOffset &&
    offsetY >= buttonTop &&
    offsetY <= buttonTop + buttonHeight
  );
}

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
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const headerCell = target.closest(
        ".PlaygroundEditorTheme__tableCellHeader"
      );

      if (!headerCell) {
        return;
      }

      // 檢查是否點擊在 pseudo-element 區域
      if (!isPseudoElementClick(event, headerCell)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      // Find column index
      const row = headerCell.parentElement;
      if (!row) return;

      const cells = Array.from(row.children);
      const columnIndex = cells.indexOf(headerCell);

      if (columnIndex === -1) return;

      // Find the table element that contains this header
      const tableElement = headerCell.closest("table");
      if (!tableElement) return;

      // Find and execute sort on the specific table
      editor.update(() => {
        const root = $getRoot();
        let targetTableNode: TableNode | null = null;
        let tableIndex = -1;

        // Get tables from editor root element instead of entire document
        const editorElement = editor.getRootElement();
        const allTables = editorElement?.querySelectorAll("table") || [];

        function traverse(node: unknown) {
          const typedNode = node as {
            getType?: () => string;
            getChildren?: () => unknown[];
          };
          if (typedNode.getType && typedNode.getType() === "table") {
            tableIndex++;

            // Match DOM table with Lexical table node by index within editor scope
            if (allTables[tableIndex] === tableElement) {
              targetTableNode = typedNode as TableNode;
              return;
            }
          }
          if (typedNode.getChildren) {
            const children = typedNode.getChildren();
            children.forEach((child: unknown) => traverse(child));
          }
        }

        traverse(root);

        if (targetTableNode) {
          const tableKey = targetTableNode.getKey();
          const currentSortState = sortStates.get(tableKey);
          const data = $getTableCellData(targetTableNode);

          // Store original children data if this is the first sort operation for this table
          if (!originalTableChildren.has(tableKey)) {
            const children = $captureOriginalTableChildren(targetTableNode);
            setOriginalTableChildren((prev) => new Map(prev).set(tableKey, children));
          }

          // Determine next state: null → asc → desc → null (cycle)
          let newSortState: TableSortState = null;
          let shouldRestoreOriginal = false;

          if (
            !currentSortState ||
            currentSortState.columnIndex !== columnIndex
          ) {
            // First click on this column: sort ascending
            newSortState = { columnIndex, direction: "asc" };
            const dataToApply = sortTableCellData(data, columnIndex, "asc");
            $updateTableDataWithDirectMovement(targetTableNode, dataToApply);
          } else if (currentSortState.direction === "asc") {
            // Second click: sort descending
            newSortState = { columnIndex, direction: "desc" };
            const dataToApply = sortTableCellData(data, columnIndex, "desc");
            $updateTableDataWithDirectMovement(targetTableNode, dataToApply);
          } else {
            // Third click: cancel sort (restore original data)
            newSortState = null;
            shouldRestoreOriginal = true;
            const originalChildren = originalTableChildren.get(tableKey);
            if (originalChildren) {
              $restoreOriginalTableChildren(targetTableNode, originalChildren);
            }
          }

          // Clear sort classes only from this table's headers
          const thisTableHeaders = tableElement.querySelectorAll(
            ".PlaygroundEditorTheme__tableCellHeader"
          );
          thisTableHeaders.forEach((cell) => {
            cell.classList.remove("sort-asc", "sort-desc");
          });

          // Add sort class to current cell (if sorting)
          if (newSortState) {
            headerCell.classList.add(
              newSortState.direction === "asc" ? "sort-asc" : "sort-desc"
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

    // 使用事件代理：監聽編輯器容器而非整個 document
    // 這樣範圍更精確，同時避免 DOM 重新渲染的問題
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
