/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import './styles.css';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {throttle} from 'lodash-es';
import {useCallback, useEffect, useRef, useState} from 'react';

import {
  addClickEventHandlers,
  applyStickyContainerStyles,
  applyStickyTableTransform,
  calculateStickyPosition,
  createStickyHeader,
  CSS_SELECTORS,
  findAllTables,
  generateTableId,
  handleStickyHeaderError,
  shouldShowStickyHeader,
  type StickyTableHeader,
  syncColumnWidthsAndContent,
  syncSortStates,
  tableHasSortableHeaders,
  THROTTLE_CONFIG,
  TIMING_CONFIG,
} from './utils';

export default function TableHeaderStickyPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [stickyHeaders, setStickyHeaders] = useState<
    Map<string, StickyTableHeader>
  >(new Map());
  const stickyHeadersRef = useRef<Map<string, StickyTableHeader>>(new Map());
  const handleScrollRef = useRef<(() => void) | null>(null);

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

        if (shouldShowStickyHeader(headerRect, tableRect)) {
          // Calculate position and apply styles
          const position = calculateStickyPosition(
            tableRect,
            editorElement,
          );

          applyStickyContainerStyles(stickyContainer, position);
          applyStickyTableTransform(stickyTable, position.tableVisibleLeft);
          syncColumnWidthsAndContent(headerRow, stickyTable);
        } else {
          // Hide sticky header
          stickyContainer.style.display = 'none';
        }
      } catch (error) {
        handleStickyHeaderError(
          error as Error,
          stickyHeader.id,
          'update',
          stickyContainer,
        );
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
    }, THROTTLE_CONFIG.SCROLL),
    [updateStickyHeader],
  );

  // Store the scroll handler in ref for removal
  useEffect(() => {
    handleScrollRef.current = handleScroll;
  }, [handleScroll]);

  // Handle resize events with throttling
  const handleResize = useCallback(
    throttle(() => {
      stickyHeadersRef.current.forEach((stickyHeader) => {
        updateStickyHeader(stickyHeader);
      });
    }, THROTTLE_CONFIG.RESIZE),
    [updateStickyHeader],
  );

  // Handle horizontal scroll events with throttling
  const handleHorizontalScroll = useCallback(
    throttle(() => {
      stickyHeadersRef.current.forEach((stickyHeader) => {
        updateStickyHeader(stickyHeader);
      });
    }, THROTTLE_CONFIG.HORIZONTAL_SCROLL),
    [updateStickyHeader],
  );

  // Sync sticky header sort states with original table
  const handleSyncSortStates = useCallback(() => {
    stickyHeadersRef.current.forEach((stickyHeader) => {
      syncSortStates(stickyHeader.originalTable, stickyHeader.stickyTable);
    });
  }, []);

  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (!editorElement) {
      return;
    }

    // Function to setup intersection observer for a table
    const setupTableObserver = (table: HTMLTableElement) => {
      // Only create sticky headers for tables with sortable headers (TableSortFilterPlugin)
      if (!tableHasSortableHeaders(table)) {
        return null; // Skip tables without sort functionality
      }

      const tableId = generateTableId();
      table.setAttribute('data-sticky-table-id', tableId);

      const stickyHeader = createStickyHeader(table, tableId, editorElement);
      
      // Add click event handlers
      addClickEventHandlers(
        stickyHeader.stickyTable,
        stickyHeader.originalTable,
        handleScrollRef,
      );

      setStickyHeaders((prev) => new Map(prev).set(tableId, stickyHeader));
      return stickyHeader;
    };

    // Initialize sticky headers for existing tables
    const initializeStickyHeaders = () => {
      const tables = findAllTables(editorElement);
      tables.forEach((table) => {
        if (!table.hasAttribute('data-sticky-table-id')) {
          setupTableObserver(table);
        }
      });
    };

    // Cleanup orphaned sticky headers (for tables that no longer exist)
    const cleanupOrphanedHeaders = () => {
      const currentTables = findAllTables(editorElement);
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
    const editorScroller = document.querySelector(CSS_SELECTORS.EDITOR_SCROLLER);
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
            CSS_SELECTORS.TABLE_CELL_HEADER.slice(1), // Remove leading dot
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
          handleSyncSortStates();
        }, TIMING_CONFIG.DOM_UPDATE_DELAY);
      } else if (shouldCleanupOrphanedHeaders) {
        cleanupOrphanedHeaders();
      } else if (shouldSyncSortStates) {
        // Sync sort states immediately
        handleSyncSortStates();
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
      handleSyncSortStates();
    }, TIMING_CONFIG.SORT_SYNC_INTERVAL);

    // Cleanup on unmount
    return () => {
      cleanup();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);

      // Remove horizontal scroll listener
      const editorScroller = document.querySelector(CSS_SELECTORS.EDITOR_SCROLLER);
      if (editorScroller) {
        editorScroller.removeEventListener('scroll', handleHorizontalScroll);
      }

      mutationObserver.disconnect();
      clearInterval(sortSyncInterval);
    };
  }, [
    editor,
    handleScroll,
    handleResize,
    handleHorizontalScroll,
    handleSyncSortStates,
  ]);

  return null;
}