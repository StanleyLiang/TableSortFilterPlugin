/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import './styles.css';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {throttle} from 'lodash-es';
import {useCallback, useEffect, useRef, useState} from 'react';

import {
  applyStickyScrollerStyles,
  calculateStickyScrollerPosition,
  createStickyScroller,
  CSS_SELECTORS,
  findAllTables,
  generateTableId,
  getTableScrollContainer,
  handleStickyScrollerError,
  shouldShowStickyScroller,
  type StickyTableScroller,
  syncScrollPosition,
  tableNeedsHorizontalScroll,
  THROTTLE_CONFIG,
  TIMING_CONFIG,
} from './utils';

export default function TableStickyScrollerPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [stickyScrollers, setStickyScrollers] = useState<
    Map<string, StickyTableScroller>
  >(new Map());
  const stickyScrollersRef = useRef<Map<string, StickyTableScroller>>(
    new Map(),
  );

  // Keep ref in sync with state
  useEffect(() => {
    stickyScrollersRef.current = stickyScrollers;
  }, [stickyScrollers]);

  // Function to update sticky scroller position and visibility
  const updateStickyScroller = useCallback(
    (stickyScroller: StickyTableScroller) => {
      const editorElement = editor.getRootElement();
      const editorScrollerElement = document.querySelector(
        CSS_SELECTORS.EDITOR_SCROLLER,
      );

      if (!editorElement || !editorScrollerElement) {
        return;
      }

      const {
        originalTable,
        stickyScrollerContainer,
        stickyScroller: scrollerDiv,
        stickyScrollerInner,
      } = stickyScroller;

      try {
        const tableRect = originalTable.getBoundingClientRect();
        const editorScrollerRect =
          editorScrollerElement.getBoundingClientRect();

        // Check if we should show the sticky scroller
        if (
          tableNeedsHorizontalScroll(originalTable) &&
          shouldShowStickyScroller(tableRect, editorScrollerRect)
        ) {
          // Calculate position and apply styles
          const position = calculateStickyScrollerPosition(
            tableRect,
            editorScrollerRect,
          );

          applyStickyScrollerStyles(
            stickyScrollerContainer,
            scrollerDiv,
            stickyScrollerInner,
            position,
          );

          // Sync scroll position from table to sticky scroller
          const tableScrollContainer = getTableScrollContainer(originalTable);
          if (tableScrollContainer) {
            syncScrollPosition(tableScrollContainer, scrollerDiv);
          }
        } else {
          // Hide sticky scroller
          stickyScrollerContainer.style.display = 'none';
        }
      } catch (error) {
        handleStickyScrollerError(
          error as Error,
          stickyScroller.id,
          'update',
          stickyScrollerContainer,
        );
      }
    },
    [editor],
  );

  // Handle scroll events with throttling for performance
  const handleVerticalScroll = useCallback(
    () =>
      throttle(() => {
        stickyScrollersRef.current.forEach((stickyScroller) => {
          updateStickyScroller(stickyScroller);
        });
      }, THROTTLE_CONFIG.SCROLL),
    [updateStickyScroller],
  );

  // Handle horizontal scroll events with throttling
  const handleHorizontalScroll = useCallback(
    () =>
      throttle((event: Event) => {
        const target = event.target as HTMLElement;

        stickyScrollersRef.current.forEach((stickyScroller) => {
          // Sync scroll position between table and sticky scroller
          if (target === stickyScroller.stickyScroller) {
            // Scroll came from sticky scroller, sync to table
            const tableScrollContainer = getTableScrollContainer(
              stickyScroller.originalTable,
            );
            if (tableScrollContainer) {
              syncScrollPosition(
                stickyScroller.stickyScroller,
                tableScrollContainer,
              );
            }
          } else if (
            target.contains &&
            target.contains(stickyScroller.originalTable)
          ) {
            // Scroll came from table area, sync to sticky scroller
            syncScrollPosition(target, stickyScroller.stickyScroller);
          }
        });
      }, THROTTLE_CONFIG.HORIZONTAL_SCROLL),
    [],
  );

  // Handle resize events with throttling
  const handleResize = useCallback(
    () =>
      throttle(() => {
        stickyScrollersRef.current.forEach((stickyScroller) => {
          updateStickyScroller(stickyScroller);
        });
      }, THROTTLE_CONFIG.RESIZE),
    [updateStickyScroller],
  );

  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (!editorElement) {
      return;
    }

    // Function to setup sticky scroller for a table
    const setupTableScroller = (table: HTMLTableElement) => {
      // Only create sticky scrollers for tables that need horizontal scrolling
      if (!tableNeedsHorizontalScroll(table)) {
        return null;
      }

      const tableId = generateTableId();
      table.setAttribute('data-sticky-scroller-id', tableId);

      const stickyScroller = createStickyScroller(table, tableId);

      // Add scroll event handler to the sticky scroller
      stickyScroller.stickyScroller.addEventListener(
        'scroll',
        handleHorizontalScroll(),
        {
          passive: true,
        },
      );

      setStickyScrollers((prev) => new Map(prev).set(tableId, stickyScroller));
      return stickyScroller;
    };

    // Initialize sticky scrollers for existing tables
    const initializeStickyScrollers = () => {
      const tables = findAllTables(editorElement);
      tables.forEach((table) => {
        if (!table.hasAttribute('data-sticky-scroller-id')) {
          setupTableScroller(table);
        }
      });
    };

    // Cleanup orphaned sticky scrollers (for tables that no longer exist)
    const cleanupOrphanedScrollers = () => {
      const currentTables = findAllTables(editorElement);
      const orphanedIds: string[] = [];

      stickyScrollersRef.current.forEach((stickyScroller, tableId) => {
        const tableStillExists = currentTables.some(
          (table) => table.getAttribute('data-sticky-scroller-id') === tableId,
        );

        if (!tableStillExists) {
          // Remove sticky scroller from DOM
          if (stickyScroller.stickyScrollerContainer.parentNode) {
            stickyScroller.stickyScrollerContainer.parentNode.removeChild(
              stickyScroller.stickyScrollerContainer,
            );
          }
          orphanedIds.push(tableId);
        }
      });

      // Update state by removing orphaned scrollers
      if (orphanedIds.length > 0) {
        setStickyScrollers((prev) => {
          const newMap = new Map(prev);
          orphanedIds.forEach((id) => newMap.delete(id));
          return newMap;
        });
      }
    };

    // Cleanup function
    const cleanup = () => {
      stickyScrollersRef.current.forEach((stickyScroller) => {
        if (stickyScroller.stickyScrollerContainer.parentNode) {
          stickyScroller.stickyScrollerContainer.parentNode.removeChild(
            stickyScroller.stickyScrollerContainer,
          );
        }
      });
      setStickyScrollers(new Map());
    };

    // Initial setup
    initializeStickyScrollers();

    // Add event listeners
    window.addEventListener('scroll', handleVerticalScroll(), {passive: true});
    window.addEventListener('resize', handleResize());

    // Add horizontal scroll listener to editor-scroller
    const editorScroller = document.querySelector(
      CSS_SELECTORS.EDITOR_SCROLLER,
    );
    if (editorScroller) {
      editorScroller.addEventListener('scroll', handleHorizontalScroll(), {
        passive: true,
      });
    }

    // Use MutationObserver to watch for new tables and table changes
    const mutationObserver = new MutationObserver((mutations) => {
      let shouldReinitialize = false;
      let shouldCleanupOrphanedScrollers = false;

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
                shouldCleanupOrphanedScrollers = true;
              }
            }
          });
        }
      });

      if (shouldReinitialize) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          if (shouldCleanupOrphanedScrollers) {
            cleanupOrphanedScrollers();
          }
          initializeStickyScrollers();
        }, TIMING_CONFIG.DOM_UPDATE_DELAY);
      } else if (shouldCleanupOrphanedScrollers) {
        cleanupOrphanedScrollers();
      }
    });

    mutationObserver.observe(editorElement, {
      childList: true,
      subtree: true,
    });

    // Cleanup on unmount
    return () => {
      cleanup();
      window.removeEventListener('scroll', handleVerticalScroll());
      window.removeEventListener('resize', handleResize());

      // Remove horizontal scroll listener
      const editorScrollerForCleanup = document.querySelector(
        CSS_SELECTORS.EDITOR_SCROLLER,
      );
      if (editorScrollerForCleanup) {
        editorScrollerForCleanup.removeEventListener(
          'scroll',
          handleHorizontalScroll(),
        );
      }

      mutationObserver.disconnect();
    };
  }, [
    editor,
    handleVerticalScroll,
    handleResize,
    handleHorizontalScroll,
    updateStickyScroller,
  ]);

  return null;
}
