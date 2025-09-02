/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import './styles.css';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {useLexicalEditable} from '@lexical/react/useLexicalEditable';
import {throttle} from 'lodash-es';
import {useCallback, useEffect, useRef, useState} from 'react';

interface StickyTableHeader {
  id: string;
  originalTable: HTMLTableElement;
  stickyContainer: HTMLDivElement;
  stickyTable: HTMLTableElement;
}

export default function TableHeaderStickyPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [stickyHeaders, setStickyHeaders] = useState<
    Map<string, StickyTableHeader>
  >(new Map());
  const stickyHeadersRef = useRef<Map<string, StickyTableHeader>>(new Map());

  // Keep ref in sync with state
  useEffect(() => {
    stickyHeadersRef.current = stickyHeaders;
  }, [stickyHeaders]);

  // Function to update sticky header position and visibility
  const updateStickyHeader = useCallback(
    (stickyHeader: StickyTableHeader) => {
      const editorElement = editor.getRootElement();
      if (!editorElement) {
        return;
      }
      const {originalTable, stickyContainer, stickyTable} = stickyHeader;

      try {
        const tableRect = originalTable.getBoundingClientRect();
        const headerRow = originalTable.querySelector('tr');

        if (!headerRow) {
          return;
        }

        const headerRect = headerRow.getBoundingClientRect();

        // Check if header is above the viewport top (out of view)
        // Use viewport coordinates for more reliable detection
        const isHeaderOutOfView = headerRect.bottom < 0;

        // Check if table is still visible (any part of it)
        const isTableVisible =
          tableRect.bottom > 0 && tableRect.top < window.innerHeight;

        // Check if table top is still below the viewport (hasn't been scrolled completely past)
        const isTableCompletelyAboveView = tableRect.bottom < 0;

        const shouldShow =
          isHeaderOutOfView && isTableVisible && !isTableCompletelyAboveView;

        if (shouldShow) {
          // Find toolbar height to avoid overlapping
          const toolbar = document.querySelector('.toolbar');
          const toolbarHeight = toolbar
            ? toolbar.getBoundingClientRect().height
            : 0;

          // Get editor-scroller bounds to constrain sticky header width
          const editorScroller = document.querySelector('.editor-scroller');
          const scrollerRect = editorScroller
            ? editorScroller.getBoundingClientRect()
            : editorElement.getBoundingClientRect();

          // Get horizontal scroll offset from editor-scroller
          const horizontalScrollOffset = editorScroller
            ? editorScroller.scrollLeft
            : 0;

          // Calculate constrained width and position
          const maxWidth = scrollerRect.width;

          // Position sticky container to match the visible portion of the table
          const leftPosition = Math.max(tableRect.left, scrollerRect.left);
          const rightBoundary = Math.min(tableRect.right, scrollerRect.right);
          const availableWidth = rightBoundary - leftPosition;

          // Show sticky header
          stickyContainer.style.display = 'block';
          stickyContainer.style.position = 'fixed';
          stickyContainer.style.top = `${toolbarHeight}px`; // Position below toolbar
          stickyContainer.style.left = `${leftPosition}px`;
          stickyContainer.style.width = `${availableWidth}px`;
          stickyContainer.style.maxWidth = `${maxWidth}px`;
          stickyContainer.style.overflow = 'hidden';
          stickyContainer.style.zIndex = '9999';

          // Position sticky table to match the original table exactly
          // Calculate how much the original table has been scrolled out of view
          const tableVisibleLeft = Math.max(
            0,
            scrollerRect.left - tableRect.left,
          );
          stickyTable.style.transform = `translateX(-${tableVisibleLeft}px)`;

          // Debug: Log scroll alignment values
          if (horizontalScrollOffset > 0) {
            console.log('Scroll Debug:', {
              horizontalScrollOffset,
              tableVisibleLeft,
              tableLeft: tableRect.left,
              tableRight: tableRect.right,
              scrollerLeft: scrollerRect.left,
              scrollerRight: scrollerRect.right,
              leftPosition,
              availableWidth,
            });
          }

          // Sync column widths and content
          const originalCells = headerRow.querySelectorAll('th, td');
          const stickyCells = stickyTable.querySelectorAll('th, td');

          originalCells.forEach((originalCell, index) => {
            if (stickyCells[index]) {
              const cellRect = originalCell.getBoundingClientRect();
              (
                stickyCells[index] as HTMLElement
              ).style.width = `${cellRect.width}px`;
              (
                stickyCells[index] as HTMLElement
              ).style.minWidth = `${cellRect.width}px`;
              (
                stickyCells[index] as HTMLElement
              ).style.maxWidth = `${cellRect.width}px`;

              // Sync content every time - this ensures content is always up-to-date
              (stickyCells[index] as HTMLElement).innerHTML = (
                originalCell as HTMLElement
              ).innerHTML;
            }
          });
        } else {
          // Hide sticky header
          stickyContainer.style.display = 'none';
        }
      } catch (error) {
        console.warn('Error updating sticky header:', error);
        stickyContainer.style.display = 'none';
      }
    },
    [editor],
  );

  // Handle scroll events with throttling for performance
  const handleScroll = useCallback(
    throttle(() => {
      stickyHeadersRef.current.forEach((stickyHeader) => {
        updateStickyHeader(stickyHeader);
      });
    }, 16), // ~60fps
    [updateStickyHeader],
  );

  // Handle resize events with throttling
  const handleResize = useCallback(
    throttle(() => {
      stickyHeadersRef.current.forEach((stickyHeader) => {
        updateStickyHeader(stickyHeader);
      });
    }, 100),
    [updateStickyHeader],
  );

  // Handle horizontal scroll events with throttling
  const handleHorizontalScroll = useCallback(
    throttle(() => {
      stickyHeadersRef.current.forEach((stickyHeader) => {
        updateStickyHeader(stickyHeader);
      });
    }, 16), // ~60fps for smooth scroll sync
    [updateStickyHeader],
  );

  // Sync sticky header sort states with original table
  const syncSortStates = useCallback(() => {
    stickyHeadersRef.current.forEach((stickyHeader) => {
      const {originalTable, stickyTable} = stickyHeader;

      // Copy sort classes from original to sticky
      const originalHeaders = originalTable.querySelectorAll(
        '.PlaygroundEditorTheme__tableCellHeader',
      );
      const stickyTableHeaders = stickyTable.querySelectorAll(
        '.PlaygroundEditorTheme__tableCellHeader',
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
    });
  }, []);

  useEffect(() => {
    if (!isEditable) {
      return;
    }

    const editorElement = editor.getRootElement();
    if (!editorElement) {
      return;
    }

    // Function to find all tables in the editor
    const findAllTables = (): HTMLTableElement[] => {
      return Array.from(editorElement.querySelectorAll('table'));
    };

    // Function to create sticky header for a table
    const createStickyHeader = (
      table: HTMLTableElement,
      tableId: string,
    ): StickyTableHeader => {
      // Create sticky container
      const stickyContainer = document.createElement('div');
      stickyContainer.className = 'table-header-sticky-container';
      stickyContainer.setAttribute('data-table-id', tableId);

      // Create a new table and manually build the header row
      const stickyTable = document.createElement('table');
      stickyTable.className = table.className + ' table-header-sticky';

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

      // Add click event handlers to sticky header cells
      const stickyHeaderCells = stickyTable.querySelectorAll(
        '.PlaygroundEditorTheme__tableCellHeader',
      );
      const originalHeaderCells = table.querySelectorAll(
        '.PlaygroundEditorTheme__tableCellHeader',
      );

      stickyHeaderCells.forEach((stickyCell, index) => {
        stickyCell.addEventListener('click', (event) => {
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
        });
      });

      // Position the sticky container
      const tableRect = table.getBoundingClientRect();
      const editorRect = editorElement.getBoundingClientRect();

      stickyContainer.style.position = 'fixed';
      stickyContainer.style.top = `${editorRect.top}px`;
      stickyContainer.style.left = `${tableRect.left}px`;
      stickyContainer.style.width = `${tableRect.width}px`;
      stickyContainer.style.zIndex = '1000';
      stickyContainer.style.display = 'none'; // Initially hidden

      // Append to body
      document.body.appendChild(stickyContainer);

      return {
        id: tableId,
        originalTable: table,
        stickyContainer,
        stickyTable,
      };
    };

    // Function to setup intersection observer for a table
    const setupTableObserver = (table: HTMLTableElement) => {
      const tableId = `table-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      table.setAttribute('data-sticky-table-id', tableId);

      const stickyHeader = createStickyHeader(table, tableId);
      setStickyHeaders((prev) => new Map(prev).set(tableId, stickyHeader));

      return stickyHeader;
    };

    // Initialize sticky headers for existing tables
    const initializeStickyHeaders = () => {
      const tables = findAllTables();
      tables.forEach((table) => {
        if (!table.hasAttribute('data-sticky-table-id')) {
          setupTableObserver(table);
        }
      });
    };

    // Cleanup orphaned sticky headers (for tables that no longer exist)
    const cleanupOrphanedHeaders = () => {
      const currentTables = findAllTables();
      const orphanedIds: string[] = [];

      stickyHeadersRef.current.forEach((stickyHeader, tableId) => {
        const tableStillExists = currentTables.some(
          (table) => table.getAttribute('data-sticky-table-id') === tableId,
        );

        if (!tableStillExists) {
          // Remove sticky header from DOM
          if (stickyHeader.stickyContainer.parentNode) {
            stickyHeader.stickyContainer.parentNode.removeChild(
              stickyHeader.stickyContainer,
            );
          }
          orphanedIds.push(tableId);
        }
      });

      // Update state by removing orphaned headers
      if (orphanedIds.length > 0) {
        setStickyHeaders((prev) => {
          const newMap = new Map(prev);
          orphanedIds.forEach((id) => newMap.delete(id));
          return newMap;
        });
      }
    };

    // Cleanup function
    const cleanup = () => {
      stickyHeadersRef.current.forEach((stickyHeader) => {
        if (stickyHeader.stickyContainer.parentNode) {
          stickyHeader.stickyContainer.parentNode.removeChild(
            stickyHeader.stickyContainer,
          );
        }
      });
      setStickyHeaders(new Map());
    };

    // Initial setup
    initializeStickyHeaders();

    // Add event listeners
    window.addEventListener('scroll', handleScroll, {passive: true});
    window.addEventListener('resize', handleResize);

    // Add horizontal scroll listener to editor-scroller
    const editorScroller = document.querySelector('.editor-scroller');
    if (editorScroller) {
      editorScroller.addEventListener('scroll', handleHorizontalScroll, {
        passive: true,
      });
    }

    // Use MutationObserver to watch for new tables and sort state changes
    const mutationObserver = new MutationObserver((mutations) => {
      let shouldReinitialize = false;
      let shouldSyncSortStates = false;
      let shouldCleanupOrphanedHeaders = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check for added tables
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (
                element.tagName === 'TABLE' ||
                element.querySelector('table')
              ) {
                shouldReinitialize = true;
              }
            }
          });

          // Check for removed tables
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (
                element.tagName === 'TABLE' ||
                element.querySelector('table')
              ) {
                shouldCleanupOrphanedHeaders = true;
              }
            }
          });
        }

        // Watch for class changes on table headers (sort state changes)
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class' &&
          mutation.target instanceof Element &&
          mutation.target.classList.contains(
            'PlaygroundEditorTheme__tableCellHeader',
          )
        ) {
          shouldSyncSortStates = true;
        }
      });

      if (shouldReinitialize) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          if (shouldCleanupOrphanedHeaders) {
            cleanupOrphanedHeaders();
          }
          initializeStickyHeaders();
          syncSortStates();
        }, 100);
      } else if (shouldCleanupOrphanedHeaders) {
        cleanupOrphanedHeaders();
      } else if (shouldSyncSortStates) {
        // Sync sort states immediately
        syncSortStates();
      }
    });

    mutationObserver.observe(editorElement, {
      attributeFilter: ['class'],
      attributes: true,
      childList: true,
      subtree: true,
    });

    // Periodically sync sort states to ensure consistency
    const sortSyncInterval = setInterval(() => {
      syncSortStates();
    }, 1000);

    // Cleanup on unmount
    return () => {
      cleanup();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);

      // Remove horizontal scroll listener
      const editorScroller = document.querySelector('.editor-scroller');
      if (editorScroller) {
        editorScroller.removeEventListener('scroll', handleHorizontalScroll);
      }

      mutationObserver.disconnect();
      clearInterval(sortSyncInterval);
    };
  }, [
    editor,
    isEditable,
    handleScroll,
    handleResize,
    handleHorizontalScroll,
    syncSortStates,
  ]);

  return null;
}