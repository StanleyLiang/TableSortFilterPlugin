/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

// Constants for better maintainability
export const THROTTLE_CONFIG = {
  
HORIZONTAL_SCROLL: 16, 
  // ~60fps
RESIZE: 100,
  SCROLL: 16, // ~60fps for smooth scroll sync
} as const;

export const TIMING_CONFIG = {
  DOM_UPDATE_DELAY: 100, // Delay for DOM updates in mutation observer
} as const;

export const Z_INDEX = {
  // Slightly below sticky header
INITIAL: '1000', 
  STICKY_SCROLLER: '9998',
} as const;

export const CSS_SELECTORS = {
  EDITOR_SCROLLER: '.editor-scroller',
  TABLE_STICKY_SCROLLER: 'table-sticky-scroller',
  TABLE_STICKY_SCROLLER_CONTAINER: 'table-sticky-scroller-container',
  TABLE_STICKY_SCROLLER_INNER: 'table-sticky-scroller-inner',
} as const;

export interface StickyTableScroller {
  id: string;
  originalTable: HTMLTableElement;
  stickyScrollerContainer: HTMLDivElement;
  stickyScroller: HTMLDivElement;
  stickyScrollerInner: HTMLDivElement;
}

export interface StickyScrollerPosition {
  leftPosition: number;
  bottomPosition: number;
  width: number;
  scrollerHeight: number;
  innerWidth: number;
}

// Generate a unique table ID
export function generateTableId(): string {
  return `table-scroller-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
}

// Find all tables in the editor
export function findAllTables(editorElement: HTMLElement): HTMLTableElement[] {
  return Array.from(editorElement.querySelectorAll('table'));
}

// Check if a table needs horizontal scrolling
export function tableNeedsHorizontalScroll(table: HTMLTableElement): boolean {
  const editorScroller = document.querySelector(CSS_SELECTORS.EDITOR_SCROLLER);
  if (!editorScroller) {
    return false;
  }

  const tableRect = table.getBoundingClientRect();
  const scrollerRect = editorScroller.getBoundingClientRect();

  // Table needs horizontal scrolling if it's wider than the scroller
  return tableRect.width > scrollerRect.width;
}

// Check if table's scrollbar is out of view (sticky scroller should be shown)
export function shouldShowStickyScroller(
  tableRect: DOMRect,
  editorScrollerRect: DOMRect,
): boolean {
  // Show sticky scroller when table extends below the viewport
  // and the table's bottom (where scrollbar would be) is out of view
  const tableBottomOutOfView = tableRect.bottom > window.innerHeight;
  const tableStillVisible =
    tableRect.top < window.innerHeight && tableRect.bottom > 0;

  return tableBottomOutOfView && tableStillVisible;
}

// Calculate sticky scroller position and dimensions
export function calculateStickyScrollerPosition(
  tableRect: DOMRect,
  editorScrollerRect: DOMRect,
): StickyScrollerPosition {
  // Position at bottom of viewport with some padding
  const bottomPosition = 20; // 20px from bottom
  const scrollerHeight = 16; // Standard scrollbar height

  // Match the visible width of the table within the editor scroller
  const leftPosition = Math.max(tableRect.left, editorScrollerRect.left);
  const rightBoundary = Math.min(tableRect.right, editorScrollerRect.right);
  const width = rightBoundary - leftPosition;

  // Inner width should match the actual table width for proper scrolling
  const innerWidth = tableRect.width;

  return {
    bottomPosition,
    innerWidth,
    leftPosition,
    scrollerHeight,
    width,
  };
}

// Apply styles to sticky scroller container
export function applyStickyScrollerStyles(
  container: HTMLDivElement,
  scroller: HTMLDivElement,
  inner: HTMLDivElement,
  position: StickyScrollerPosition,
): void {
  // Container styles
  container.style.position = 'fixed';
  container.style.bottom = `${position.bottomPosition}px`;
  container.style.left = `${position.leftPosition}px`;
  container.style.width = `${position.width}px`;
  container.style.height = `${position.scrollerHeight}px`;
  container.style.zIndex = Z_INDEX.STICKY_SCROLLER;
  container.style.display = 'block';

  // Scroller styles
  scroller.style.width = '100%';
  scroller.style.height = '100%';
  scroller.style.overflowX = 'auto';
  scroller.style.overflowY = 'hidden';

  // Inner element to create scrollable width
  inner.style.width = `${position.innerWidth}px`;
  inner.style.height = '1px';
}

// Create a sticky scroller for a table
export function createStickyScroller(
  table: HTMLTableElement,
  tableId: string,
): StickyTableScroller {
  // Create container
  const container = document.createElement('div');
  container.className = CSS_SELECTORS.TABLE_STICKY_SCROLLER_CONTAINER;
  container.setAttribute('data-table-id', tableId);

  // Create scroller element
  const scroller = document.createElement('div');
  scroller.className = CSS_SELECTORS.TABLE_STICKY_SCROLLER;

  // Create inner element to define scrollable width
  const inner = document.createElement('div');
  inner.className = CSS_SELECTORS.TABLE_STICKY_SCROLLER_INNER;

  scroller.appendChild(inner);
  container.appendChild(scroller);

  // Initially hidden
  container.style.display = 'none';

  // Append to body
  document.body.appendChild(container);

  return {
    id: tableId,
    originalTable: table,
    stickyScroller: scroller,
    stickyScrollerContainer: container,
    stickyScrollerInner: inner,
  };
}

// Sync scroll position between table and sticky scroller
export function syncScrollPosition(
  fromElement: HTMLElement,
  toElement: HTMLElement,
): void {
  if (fromElement && toElement) {
    toElement.scrollLeft = fromElement.scrollLeft;
  }
}

// Get the scrollable container for a table
export function getTableScrollContainer(
  table: HTMLTableElement,
): HTMLElement | null {
  const editorScroller = document.querySelector(CSS_SELECTORS.EDITOR_SCROLLER);
  return (editorScroller as HTMLElement) || null;
}

// Check if a table is potentially visible in the viewport (with buffer)
export function isTablePotentiallyVisible(table: HTMLTableElement): boolean {
  const rect = table.getBoundingClientRect();
  const buffer = 200; // 200px buffer for performance

  return rect.bottom > -buffer && rect.top < window.innerHeight + buffer;
}

// Unified error handling for sticky scroller operations
export function handleStickyScrollerError(
  error: Error,
  tableId: string,
  operation: string,
  container?: HTMLDivElement,
): void {
  console.warn(
    `TableStickyScroller: Error during ${operation} for table ${tableId}:`,
    error,
  );

  // Hide sticky scroller as fallback
  if (container) {
    container.style.display = 'none';
  }
}
