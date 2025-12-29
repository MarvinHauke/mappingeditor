# NerdSEQ Mapping Editor

Web editor for the NerdSEQ Mappings

## 📁 Project Structure

- **`/editor`** - Main mapping editor application (Vue.js)
- **`/tests`** - Comprehensive test files and generators
- **`/docs`** - Documentation and file format specifications
- **`/examples`** - Example mapping files
- **`/viewers`** - Standalone mapping file viewers

## 🧪 Testing

Comprehensive test files are available in the `/tests` directory:

- **Complete feature coverage** - Tests all 15 source and 17 destination types
- **Edge case validation** - Parameter boundary and range testing
- **Binary format testing** - NerdSEQ-compatible .map files for hardware testing
- **Automated generators** - Scripts to create and validate test files

See `/tests/TEST_FILES_README.md` for detailed testing instructions.

## 🚀 Quick Start

1. **Editor Development:** `cd editor && npm install && npm run dev`
2. **Run All Tests:** `node run-tests.js` (validates and regenerates all test files)
3. **Manual Testing:** `cd tests && node validate-test-files.js`

## 🎯 Test Files Ready

The `/tests` directory contains production-ready test files:

- **JSON format** for editor testing and development
- **Binary .map format** for NerdSEQ hardware compatibility testing
- **HTML reports** for visual documentation and verification
- **Complete coverage** of all 25 critical bugs fixed and all features implemented

## Getting Started

To run the editor locally:

```bash
cd editor
npm install
npm run dev
```

The development server will start and display a local URL (typically http://localhost:5173) where you can access the editor in your browser.

## Available Commands

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npm run type-check` - Run TypeScript type checking
