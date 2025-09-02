/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Constants for better maintainability
export const THROTTLE_CONFIG = {
  SCROLL: 16, // ~60fps
  RESIZE: 100,
  HORIZONTAL_SCROLL: 16, // ~60fps for smooth scroll sync
} as const;

export const TIMING_CONFIG = {
  SORT_LISTENER_DELAY: 100, // Delay before re-adding scroll listener after sort
  DOM_UPDATE_DELAY: 100, // Delay for DOM updates in mutation observer
  SORT_SYNC_INTERVAL: 1000, // Interval for periodic sort state sync
} as const;

export const Z_INDEX = {
  STICKY_HEADER: '9999',
  INITIAL: '1000',
} as const;

export const CSS_SELECTORS = {
  TOOLBAR: '.toolbar',
  EDITOR_SCROLLER: '.editor-scroller',
  TABLE_CELL_HEADER: '.PlaygroundEditorTheme__tableCellHeader',
  TABLE_HEADER_STICKY_CONTAINER: 'table-header-sticky-container',
  TABLE_HEADER_STICKY: 'table-header-sticky',
} as const;

export interface StickyTableHeader {
  id: string;
  originalTable: HTMLTableElement;
  stickyContainer: HTMLDivElement;
  stickyTable: HTMLTableElement;
}

export interface StickyHeaderPosition {
  leftPosition: number;
  availableWidth: number;
  tableVisibleLeft: number;
  maxWidth: number;
  toolbarHeight: number;
}

export interface ViewportInfo {
  editorRect: DOMRect;
  scrollerRect: DOMRect;
  toolbarHeight: number;
}


// Calculate sticky header position and dimensions
export function calculateStickyPosition(
  tableRect: DOMRect,
  editorElement: HTMLElement,
): StickyHeaderPosition {
  // Find toolbar height to avoid overlapping
  const toolbar = document.querySelector(CSS_SELECTORS.TOOLBAR);
  const toolbarHeight = toolbar
    ? toolbar.getBoundingClientRect().height
    : 0;

  // Get editor-scroller bounds to constrain sticky header width
  const editorScroller = document.querySelector(CSS_SELECTORS.EDITOR_SCROLLER);
  const scrollerRect = editorScroller
    ? editorScroller.getBoundingClientRect()
    : editorElement.getBoundingClientRect();

  // Calculate constrained width and position
  const maxWidth = scrollerRect.width;

  // Position sticky container to match the visible portion of the table
  const leftPosition = Math.max(tableRect.left, scrollerRect.left);
  const rightBoundary = Math.min(tableRect.right, scrollerRect.right);
  const availableWidth = rightBoundary - leftPosition;

  // Position sticky table to match the original table exactly
  // Calculate how much the original table has been scrolled out of view
  const tableVisibleLeft = Math.max(0, scrollerRect.left - tableRect.left);

  return {
    leftPosition,
    availableWidth,
    tableVisibleLeft,
    maxWidth,
    toolbarHeight,
  };
}

// Apply styles to sticky container
export function applyStickyContainerStyles(
  stickyContainer: HTMLDivElement,
  position: StickyHeaderPosition,
): void {
  stickyContainer.style.display = 'block';
  stickyContainer.style.position = 'fixed';
  stickyContainer.style.top = `${position.toolbarHeight}px`;
  stickyContainer.style.left = `${position.leftPosition}px`;
  stickyContainer.style.width = `${position.availableWidth}px`;
  stickyContainer.style.maxWidth = `${position.maxWidth}px`;
  stickyContainer.style.overflow = 'hidden';
  stickyContainer.style.zIndex = Z_INDEX.STICKY_HEADER;
}

// Apply horizontal scroll transform to sticky table
export function applyStickyTableTransform(
  stickyTable: HTMLTableElement,
  tableVisibleLeft: number,
): void {
  stickyTable.style.transform = `translateX(-${tableVisibleLeft}px)`;
}

// Sync column widths and content between original and sticky table
export function syncColumnWidthsAndContent(
  headerRow: HTMLElement,
  stickyTable: HTMLTableElement,
): void {
  const originalCells = headerRow.querySelectorAll('th, td');
  const stickyCells = stickyTable.querySelectorAll('th, td');

  originalCells.forEach((originalCell, index) => {
    if (stickyCells[index]) {
      const cellRect = originalCell.getBoundingClientRect();
      const stickyCell = stickyCells[index] as HTMLElement;

      stickyCell.style.width = `${cellRect.width}px`;
      stickyCell.style.minWidth = `${cellRect.width}px`;
      stickyCell.style.maxWidth = `${cellRect.width}px`;

      // Sync content every time - this ensures content is always up-to-date
      stickyCell.innerHTML = (originalCell as HTMLElement).innerHTML;
    }
  });
}

// Create a sticky header for a table
export function createStickyHeader(
  table: HTMLTableElement,
  tableId: string,
  editorElement: HTMLElement,
): StickyTableHeader {
  // Create sticky container
  const stickyContainer = document.createElement('div');
  stickyContainer.className = CSS_SELECTORS.TABLE_HEADER_STICKY_CONTAINER;
  stickyContainer.setAttribute('data-table-id', tableId);

  // Create a new table and manually build the header row
  const stickyTable = document.createElement('table');
  stickyTable.className = table.className + ' ' + CSS_SELECTORS.TABLE_HEADER_STICKY;

  // Get the original header row
  const originalHeaderRow = table.querySelector('tr');
  if (originalHeaderRow) {
    // Create new header row
    const newHeaderRow = document.createElement('tr');

    // Get all header cells from original table
    const originalCells = originalHeaderRow.querySelectorAll('th, td');

    originalCells.forEach((originalCell) => {
      // Create new cell with same tag name
      const newCell = document.createElement(
        originalCell.tagName.toLowerCase(),
      );

      // Copy all attributes
      for (let i = 0; i < originalCell.attributes.length; i++) {
        const attr = originalCell.attributes[i];
        newCell.setAttribute(attr.name, attr.value);
      }

      // Copy innerHTML to preserve all nested content and formatting
      newCell.innerHTML = originalCell.innerHTML;

      newHeaderRow.appendChild(newCell);
    });

    // Create table body and append the header row
    const tbody = document.createElement('tbody');
    tbody.appendChild(newHeaderRow);
    stickyTable.appendChild(tbody);
  }

  stickyContainer.appendChild(stickyTable);

  // Position the sticky container
  const tableRect = table.getBoundingClientRect();
  const editorRect = editorElement.getBoundingClientRect();

  stickyContainer.style.position = 'fixed';
  stickyContainer.style.top = `${editorRect.top}px`;
  stickyContainer.style.left = `${tableRect.left}px`;
  stickyContainer.style.width = `${tableRect.width}px`;
  stickyContainer.style.zIndex = Z_INDEX.INITIAL;
  stickyContainer.style.display = 'none'; // Initially hidden

  // Append to body
  document.body.appendChild(stickyContainer);

  return {
    id: tableId,
    originalTable: table,
    stickyContainer,
    stickyTable,
  };
}

// Add click event handlers to forward clicks from sticky to original headers
export function addClickEventHandlers(
  stickyTable: HTMLTableElement,
  originalTable: HTMLTableElement,
  handleScrollRef: React.MutableRefObject<(() => void) | null>,
): void {
  const stickyHeaderCells = stickyTable.querySelectorAll(
    CSS_SELECTORS.TABLE_CELL_HEADER,
  );
  const originalHeaderCells = originalTable.querySelectorAll(
    CSS_SELECTORS.TABLE_CELL_HEADER,
  );

  stickyHeaderCells.forEach((stickyCell, index) => {
    stickyCell.addEventListener('click', (event) => {
      // Remove scroll listener to prevent interference during sort state changes
      if (handleScrollRef.current) {
        window.removeEventListener('scroll', handleScrollRef.current);
      }

      // Forward the click to the corresponding original header cell
      const originalCell = originalHeaderCells[index];
      if (originalCell) {
        // Calculate the relative position within the original cell
        const stickyRect = stickyCell.getBoundingClientRect();
        const originalRect = originalCell.getBoundingClientRect();

        // Calculate offsetX and offsetY relative to the original cell
        const relativeX = event.clientX - stickyRect.left;
        const relativeY = event.clientY - stickyRect.top;

        // Create a synthetic click event for the original cell
        const syntheticEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: originalRect.left + relativeX,
          clientY: originalRect.top + relativeY,
        });

        // Set offsetX and offsetY properties manually
        Object.defineProperty(syntheticEvent, 'offsetX', {
          value: relativeX,
          writable: false,
        });
        Object.defineProperty(syntheticEvent, 'offsetY', {
          value: relativeY,
          writable: false,
        });

        // Dispatch the synthetic event to the original cell
        originalCell.dispatchEvent(syntheticEvent);
      }

      // Re-add scroll listener after a short delay to allow sort state to settle
      setTimeout(() => {
        if (handleScrollRef.current) {
          window.addEventListener('scroll', handleScrollRef.current, {
            passive: true,
          });
        }
      }, TIMING_CONFIG.SORT_LISTENER_DELAY);
    });
  });
}

// Generate a unique table ID
export function generateTableId(): string {
  return `table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Check if sticky header should be visible
export function shouldShowStickyHeader(
  headerRect: DOMRect,
  tableRect: DOMRect,
): boolean {
  // Check if header is above the viewport top (out of view)
  const isHeaderOutOfView = headerRect.bottom < 0;

  // Check if table is still visible (any part of it)
  const isTableVisible =
    tableRect.bottom > 0 && tableRect.top < window.innerHeight;

  // Check if table top is still below the viewport (hasn't been scrolled completely past)
  const isTableCompletelyAboveView = tableRect.bottom < 0;

  return isHeaderOutOfView && isTableVisible && !isTableCompletelyAboveView;
}

// Sync sort states between original and sticky tables
export function syncSortStates(
  originalTable: HTMLTableElement,
  stickyTable: HTMLTableElement,
): void {
  // Copy sort classes from original to sticky
  const originalHeaders = originalTable.querySelectorAll(
    CSS_SELECTORS.TABLE_CELL_HEADER,
  );
  const stickyTableHeaders = stickyTable.querySelectorAll(
    CSS_SELECTORS.TABLE_CELL_HEADER,
  );

  originalHeaders.forEach((originalHeader, index) => {
    const stickyTableHeader = stickyTableHeaders[index];
    if (stickyTableHeader) {
      // Remove existing sort classes
      stickyTableHeader.classList.remove('sort-asc', 'sort-desc');

      // Copy sort classes from original
      if (originalHeader.classList.contains('sort-asc')) {
        stickyTableHeader.classList.add('sort-asc');
      } else if (originalHeader.classList.contains('sort-desc')) {
        stickyTableHeader.classList.add('sort-desc');
      }
    }
  });
}

// Find all tables in the editor
export function findAllTables(editorElement: HTMLElement): HTMLTableElement[] {
  return Array.from(editorElement.querySelectorAll('table'));
}

// Check if a table has sortable headers (with pseudo-elements from TableSortFilterPlugin)
export function tableHasSortableHeaders(table: HTMLTableElement): boolean {
  const headerCells = table.querySelectorAll(
    CSS_SELECTORS.TABLE_CELL_HEADER,
  );

  // If no header cells with the sortable class, it's not sortable
  if (headerCells.length === 0) {
    return false;
  }

  // Check if any header cell has pseudo-element content (sort indicators)
  // This covers the case where no sort is active but headers are still sortable
  for (const headerCell of headerCells) {
    const pseudoStyle = window.getComputedStyle(
      headerCell as Element,
      '::after',
    );
    const content = pseudoStyle.getPropertyValue('content');

    // CSS content values 'none' or '""' indicate no pseudo-element content
    if (content !== 'none' && content !== '""' && content !== '') {
      return true; // Found at least one sortable header
    }
  }

  return false; // No sortable headers found
}

// Check if a table is potentially visible in the viewport (with some buffer)
export function isTablePotentiallyVisible(table: HTMLTableElement): boolean {
  const rect = table.getBoundingClientRect();
  const buffer = 200; // 200px buffer for performance
  
  return rect.bottom > -buffer && rect.top < window.innerHeight + buffer;
}

// Unified error handling for sticky header operations
export function handleStickyHeaderError(
  error: Error,
  tableId: string,
  operation: string,
  stickyContainer?: HTMLDivElement
): void {
  console.warn(`TableHeaderSticky: Error during ${operation} for table ${tableId}:`, error);
  
  // Hide sticky header as fallback
  if (stickyContainer) {
    stickyContainer.style.display = 'none';
  }
  
  // Could add error reporting or recovery logic here
}