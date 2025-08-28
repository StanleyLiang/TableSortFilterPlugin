/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

// Types for sort and filter state
export type TableSortState = {
  columnIndex: number;
  direction: "asc" | "desc";
} | null;

export type SortDirection = "asc" | "desc";
