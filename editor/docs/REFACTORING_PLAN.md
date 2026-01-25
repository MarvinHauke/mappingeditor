# NerdSEQ Mapping Editor - Refactoring Plan

## Overview

This document tracks recent implementations, architectural observations, and opportunities for code improvement. It serves as a living document for maintaining code quality and planning incremental refactoring.

---

## Recently Implemented Components

| Component | Purpose | Potential Improvements |
|-----------|---------|------------------------|
| `MenuButton.vue` | Unified button styling with variants | Consider adding icon slot support for icon+text buttons |
| `ToastNotifications.vue` | Transient notifications system | Currently underutilized - integrate for more events (save, export, etc.) |
| `BasePanel.vue` | Foldable side panels (Variables, Settings, MidiMonitor) | Add drag-to-dock functionality (Phase 0.1 advanced) |
| `SelectionToolbar.vue` | Multi-row operations toolbar | Consider moving to BasePanel-based implementation |
| `SettingsPanel.vue` | Settings & Info display | Consider separating concerns (settings vs. info/stats) |
| `RowCommentSection.vue` | Row details and warnings display | Well-structured, minimal changes needed |
| `RowActionButtons.vue` | Copy/paste/clear per-row actions | Could migrate to IconButton pattern |

---

## Recently Implemented Composables

| Composable | Purpose | Potential Improvements |
|------------|---------|------------------------|
| `useMappingCache.ts` | A/B slot caching with IndexedDB | Add export/import of cached slots |
| `useStaticAnalyzer.ts` | Logic validation & warning generation | Add more warning rules (out-of-range, unreachable rows) |
| `useWarningLog.ts` | Centralized warning logging | Add log export, filtering by severity |
| `useClipboard.ts` | Row/source/dest copy-paste operations | Well-structured, minimal changes needed |
| `useMidi.ts` | Web MIDI API integration | Stable, works well |
| `useMultiSelect.ts` | Multi-row selection state | Consider renaming to `useSelection.ts` |

---

## Architecture Observations

### 1. EditorApp.vue is Large (~1100 lines)

The main component handles multiple concerns:
- File I/O (import/export)
- Serialization/deserialization
- Row selection state
- Panel positioning coordination
- Document state management

**Recommended Extractions:**
- `useFileIO.ts` composable - file operations
- `useMappingSerializer.ts` composable - format conversions
- `EditorToolbar.vue` component - left menu area

### 2. Panel Positioning is Complex

Multiple panels (SettingsPanel, MidiMonitor, VariablesPanel) track each other's expanded state for vertical positioning. This creates implicit coupling.

**Current Pattern:**
```vue
:style="{ top: calculatedTop + 'px' }"
```

**Possible Improvement:**
- Create a `usePanelLayout.ts` composable to centralize panel positioning logic
- Or move to CSS-based stacking (flexbox/grid) if possible

### 3. Toast Notifications Underutilized

`ToastNotifications.vue` was created but is only used for row move warnings. Could be used for:
- File save/export success
- MIDI device connection status
- Analyzer completion
- Cache slot switches

### 4. Remaining Bootstrap Button Classes

Some buttons still use raw Bootstrap `.btn` classes instead of `MenuButton.vue`:

| File | Button | Line | Current Class |
|------|--------|------|---------------|
| `MidiMonitor.vue` | Clear button | ~125 | `btn btn-sm clear-btn` |
| `EditorApp.vue` | Row clear (X) | ~1427 | `btn btn-sm clear-btn-fixed` |
| `MidiLearnExtra.vue` | Learn button | ~214 | `btn btn-sm learn-btn` |
| `MidiLearnExtra.vue` | Cancel button | ~224 | `btn btn-sm btn-danger` |
| `RowActionButtons.vue` | Copy button | ~31 | `btn btn-sm copy-btn` |
| `RowActionButtons.vue` | Paste button | ~43 | `btn btn-sm paste-btn` |
| `SettingsPanel.vue` | HEX/DEC toggle | ~62 | `btn btn-sm toggle-btn` |

**Recommendation:** These could be migrated to:
- `MenuButton.vue` with appropriate variants, OR
- A new `IconButton.vue` component for small action buttons (icon-only or icon+label)

---

## Code Style Patterns

### Established Patterns to Follow

1. **Composables** - Extract reusable logic into `use*.ts` files
2. **TypeScript strict mode** - All code must pass type-check
3. **Reactive state** - Use Vue 3 Composition API with `ref`/`reactive`
4. **EMPTY_KEY constant** - Use `0xFFFF` for empty values
5. **Component props** - Use TypeScript interfaces for prop definitions

### Naming Conventions

- Components: PascalCase (`EditorApp.vue`)
- Composables: camelCase with `use` prefix (`useMidi.ts`)
- CSS classes: kebab-case (`.row-selected`, `.menu-btn`)
- Constants: UPPER_SNAKE_CASE (`EMPTY_KEY`)

---

## Refactoring Priorities

### Short-term (Low Effort)

1. Integrate ToastNotifications for more user feedback events
2. Update remaining buttons to use MenuButton/IconButton pattern
3. Add TypeDoc comments to public composable functions

### Medium-term (Medium Effort)

1. Extract file I/O logic from EditorApp.vue
2. Create `usePanelLayout.ts` for panel positioning
3. Add more static analyzer warning rules

### Long-term (High Effort)

1. Full EditorApp.vue decomposition
2. Implement draggable/dockable panels
3. Add comprehensive test coverage

---

## Component Dependency Graph

```
EditorApp.vue
├── MenuButton.vue
├── BasePanel.vue
│   ├── SettingsPanel.vue
│   ├── MidiMonitor.vue
│   └── VariablesPanel.vue
├── SelectionToolbar.vue
├── ToastNotifications.vue
├── RowCommentSection.vue
├── RowActionButtons.vue
└── *Extra.vue components (11 files)
    ├── CalcSkipSourceExtra.vue
    ├── DualDestinationExtra.vue
    ├── MidiCcDestinationExtra.vue
    ├── MidiLearnExtra.vue
    ├── NrpnSourceExtra.vue
    ├── SettingsPanel.vue
    ├── SkipDestinationExtra.vue
    ├── VariableDestinationExtra.vue
    ├── VariableSourceExtra.vue
    └── VisuDestinationExtra.vue
```

---

## Last Updated

2026-01-25

---
