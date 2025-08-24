/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {createCommand, LexicalCommand} from 'lexical';

import type {SortDirection} from './types';

// Commands for sort and filter functionality
export const SORT_TABLE_COLUMN_COMMAND: LexicalCommand<{
  columnIndex: number;
  direction: SortDirection;
}> = createCommand('SORT_TABLE_COLUMN_COMMAND');

export const FILTER_TABLE_COLUMN_COMMAND: LexicalCommand<{
  columnIndex: number;
  filterValue: string;
}> = createCommand('FILTER_TABLE_COLUMN_COMMAND');

export const CLEAR_TABLE_FILTERS_COMMAND: LexicalCommand<void> = createCommand(
  'CLEAR_TABLE_FILTERS_COMMAND',
);