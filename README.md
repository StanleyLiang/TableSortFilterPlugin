# TableSortFilterPlugin

A powerful Lexical plugin that adds sorting and filtering capabilities to tables in your rich text editor.

## 🚀 Features

### ✅ Currently Implemented
- **Table Sorting**: Click table headers to sort columns in ascending/descending order
- **Smart Sorting**: Automatically detects and sorts numbers vs text appropriately  
- **Visual Indicators**: Sort direction indicators (↑↓) on table headers
- **Interactive UI**: Hover effects and click feedback on table headers

### 🚧 In Development
- **Filtering UI**: Input fields for column filtering
- **Data Persistence**: Preserve original data when clearing filters
- **Advanced Sorting**: Multi-column sorting support
- **Export Functions**: Export filtered/sorted data

## 📦 Installation

```bash
npm install table-sort-filter-plugin
```

## 🛠️ Usage

```tsx
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import TableSortFilterPlugin from 'table-sort-filter-plugin';

// Add to your editor configuration
const editorConfig = {
  nodes: [TableNode, TableCellNode, TableRowNode],
  // ... other config
};

function Editor() {
  return (
    <LexicalComposer initialConfig={editorConfig}>
      {/* Other plugins */}
      <TablePlugin />
      <TableSortFilterPlugin />
    </LexicalComposer>
  );
}
```

## 🎯 How It Works

### Sorting
1. Click the right side of any table header cell
2. First click sorts ascending (↑)
3. Second click sorts descending (↓)
4. Supports both numeric and alphabetic sorting

### Commands
The plugin exposes these Lexical commands:

```tsx
import { 
  SORT_TABLE_COLUMN_COMMAND,
  FILTER_TABLE_COLUMN_COMMAND,
  CLEAR_TABLE_FILTERS_COMMAND
} from 'table-sort-filter-plugin';

// Sort a column
editor.dispatchCommand(SORT_TABLE_COLUMN_COMMAND, {
  columnIndex: 0,
  direction: 'asc'
});

// Filter a column
editor.dispatchCommand(FILTER_TABLE_COLUMN_COMMAND, {
  columnIndex: 0,
  filterValue: 'search term'
});

// Clear all filters
editor.dispatchCommand(CLEAR_TABLE_FILTERS_COMMAND, undefined);
```

## 🔧 Development

This plugin was extracted from the Lexical playground and is continuously being improved.

### Current Status
- ✅ Basic sorting functionality
- ✅ UI interactions and styling
- ⚠️ Filtering logic implemented but needs UI
- ❌ Data persistence needs improvement

### Contributing
Feel free to submit issues and enhancement requests!

## 📝 License

MIT License - see LICENSE file for details

## 🔗 Related

- [Lexical Documentation](https://lexical.dev/)
- [Lexical Table Plugin](https://lexical.dev/docs/react/plugins#lexicaltableplugin)