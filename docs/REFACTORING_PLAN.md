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

See the **Detailed Implementation Plan** section below for the comprehensive phased approach.

### Quick Reference

- **Short-term (Low Effort):** Phase 1 - Toasts, Buttons, TypeDoc comments
- **Medium-term (Medium Effort):** Phases 2-3 - Row Value Display, Global Documentation
- **Long-term (High Effort):** Phases 4-6 - useFileIO, usePanelLayout, SelectionToolbar refactoring

---

## Detailed Implementation Plan

### Overview

This plan combines short-term refactoring wins with strategic feature implementation to minimize rework and make future large refactorings easier.

### Strategic Sequencing

**Key Insight:** Phase 3 (Global Documentation) adds file I/O logic, so it should be implemented BEFORE the useFileIO refactoring. This way, when we extract useFileIO, it will include the complete file I/O logic rather than requiring a second refactoring pass.

### Recommended Implementation Sequence

1. **Phase 1:** Short-term wins (low effort, immediate impact)
2. **Phase 2:** Row Value Display (small feature, no conflicts)
3. **Phase 3:** Global Documentation (adds to file I/O before refactoring)
4. **Phase 4:** useFileIO refactoring (extracts complete file I/O including global docs)
5. **Phase 5:** usePanelLayout refactoring (architectural improvement)
6. **Phase 6:** SelectionToolbar Enhancement (benefits from usePanelLayout)
7. **Future:** Simulation Engine (big features on clean architecture)

---

### Phase 1: Short-Term Wins

#### 1.1 Expand ToastNotifications Usage

**Current State:** ToastNotifications component exists but only used for row move warnings.

**Files to Modify:**
- `editor/src/components/EditorApp.vue`
- `editor/src/components/ToastNotifications.vue`

**Add toast notifications for:**
- File save/export success
  - "Exported to HTML successfully"
  - "Saved to JSON successfully"
  - "Downloaded MAP file successfully"
- MIDI device connection status
  - "MIDI device connected: [device name]"
  - "MIDI device disconnected"
- Static analyzer completion
  - "Analysis complete: X warnings found"
  - "Analysis complete: No issues found"
- Cache slot switches
  - "Switched to Slot A"
  - "Switched to Slot B"
  - "Slot A locked/unlocked"
- File load success
  - "Loaded [filename] successfully"
  - "Loaded from cache: Slot A/B"

**Implementation Steps:**
1. Verify ToastNotifications API supports success/info/warning/error variants
2. Replace `console.log()` statements with toast notifications
3. Replace some `alert()` calls with toasts (keep critical errors as alerts)
4. Add toast calls in:
   - `downloadHtml/Json/Markdown/Map()` (success messages)
   - `handleSlotSwitch()` (slot switch confirmations)
   - `init()` after analysis (analysis results)
   - `readFile()` after successful load
   - `useMidi.ts` for device connection events (may need to emit events)

**Effort:** 2-3 hours

---

#### 1.2 Migrate Remaining Buttons to MenuButton

**Current State:** 7 buttons still use raw Bootstrap classes instead of MenuButton component.

**Files to Modify:**
- `editor/src/components/MidiMonitor.vue`
- `editor/src/components/EditorApp.vue`
- `editor/src/components/MidiLearnExtra.vue`
- `editor/src/components/RowActionButtons.vue`
- `editor/src/components/SettingsPanel.vue`

**Implementation:**

Create **IconButton.vue** component for small action buttons:
```vue
<template>
  <button
    class="icon-btn"
    :class="[variant, size]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'clear';
  size?: 'sm' | 'md';
  disabled?: boolean;
}>();

defineEmits<{
  click: [];
}>();
</script>

<style scoped>
/* Minimal button styles for icon/small buttons */
</style>
```

**Migration Strategy:**

1. Create `IconButton.vue` in `editor/src/components/`
2. Update each component:
   - `MidiMonitor.vue` line ~125: Clear button → `<IconButton variant="clear">`
   - `EditorApp.vue` line ~1427: Row clear (X) → `<IconButton variant="clear" size="sm">`
   - `MidiLearnExtra.vue` lines 214, 224: Learn/Cancel → `<IconButton>`
   - `RowActionButtons.vue` lines 31, 43: Copy/Paste → `<IconButton>`
   - `SettingsPanel.vue` line ~62: HEX/DEC toggle → MenuButton or IconButton

**Effort:** 3-4 hours

---

#### 1.3 Add TypeDoc Comments to Composables

**Files to Document:**
- `editor/src/composables/useClipboard.ts` ⭐ (well-structured)
- `editor/src/composables/useMappingCache.ts` ✅ (already has good comments)
- `editor/src/composables/useMidi.ts`
- `editor/src/composables/useStaticAnalyzer.ts`
- `editor/src/composables/useWarningLog.ts`

**Template:**
```typescript
/**
 * Composable for [purpose]
 *
 * @example
 * ```typescript
 * const { state, action } = useComposable();
 * ```
 *
 * @returns {Object} Composable API
 * @returns {Ref<T>} returns.state - Description
 * @returns {Function} returns.action - Description
 */
export function useComposable() {
  // ...
}
```

**Focus on:**
- Public API documentation
- Parameter descriptions
- Return type documentation
- Usage examples

**Effort:** 2-3 hours

**Phase 1 Total:** 7-10 hours (~1-2 days)

---

### Phase 2: Row Value Display

**Goal:** Add hex/decimal/binary value display in RowCommentSection for selected rows.

**Files to Modify:**
- `editor/src/components/RowCommentSection.vue`

**Implementation:**

Add a value monitor section when row is selected:
```vue
<div class="row-value-monitor">
  <div class="value-row">
    <span class="label">Source:</span>
    <span class="dec">{{ sourceValue }}</span>
    <span class="hex">{{ toHex(sourceValue) }}</span>
    <span class="bin">{{ toBinary(sourceValue) }}</span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill" :style="{ width: sourcePercent + '%' }"></div>
  </div>
  <div class="value-row">
    <span class="label">Dest:</span>
    <span class="dec">{{ destValue }}</span>
    <span class="hex">{{ toHex(destValue) }}</span>
    <span class="bin">{{ toBinary(destValue) }}</span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill" :style="{ width: destPercent + '%' }"></div>
  </div>
</div>
```

**New Props:**
- `sourceValue: number`
- `destinationValue: number`

**Helper Functions:**
```typescript
function toHex(value: number): string {
  return '0x' + value.toString(16).toUpperCase().padStart(4, '0');
}

function toBinary(value: number): string {
  return '0b' + value.toString(2).padStart(16, '0');
}

function toPercent(value: number): number {
  return (value / 4095) * 100;
}
```

**Effort:** 2-3 hours (~0.5 days)

---

### Phase 3: Global Documentation

**Goal:** Add mapping-level documentation stored in JSON format.

**Critical:** Do this BEFORE useFileIO refactoring so the file I/O extraction includes this logic.

#### 3.1 Extend MappingDocument Model

**File:** `editor/src/modules/documentModel.ts`

Add to MappingDocument class:
```typescript
export class MappingDocument {
  // ... existing fields

  /**
   * Optional global documentation for the mapping
   */
  globalComment?: string;

  /**
   * Optional author information
   */
  author?: string;

  /**
   * Optional version string
   */
  version?: string;

  /**
   * Optional changelog entries
   */
  changelog?: string[];
}
```

#### 3.2 Update JSON Export/Import

**File:** `editor/src/modules/formatters.ts`

Update `exportToJson()` to include new fields:
```typescript
export function exportToJson(
  document: MappingDocument,
  editorMetadata?: {
    rowColors?: Record<number, string>;
    rowComments?: Record<number, string>;
    globalComment?: string;
    author?: string;
    version?: string;
    changelog?: string[];
  }
): string {
  const json = {
    header: { ... },
    rows: [ ... ],
    variables: [ ... ],
    editorMetadata: {
      ...(editorMetadata || {}),
      globalComment: document.globalComment,
      author: document.author,
      version: document.version,
      changelog: document.changelog
    }
  };
  return JSON.stringify(json, null, 2);
}
```

**File:** `editor/src/modules/parsers.ts`

Update JSON parsing in `readFile()` to restore these fields.

#### 3.3 Add UI Component

**File:** `editor/src/components/GlobalDocumentationPanel.vue` (NEW)

Create a collapsible panel in the header:
```vue
<template>
  <BasePanel
    title="Documentation"
    :expanded="expanded"
    @toggle="$emit('toggle')"
  >
    <div class="doc-fields">
      <div class="field">
        <label>Author:</label>
        <input v-model="author" placeholder="Your name" />
      </div>
      <div class="field">
        <label>Version:</label>
        <input v-model="version" placeholder="1.0.0" />
      </div>
      <div class="field">
        <label>Description:</label>
        <textarea
          v-model="globalComment"
          placeholder="Describe this mapping..."
          rows="5"
        ></textarea>
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
const author = defineModel<string>('author');
const version = defineModel<string>('version');
const globalComment = defineModel<string>('globalComment');

defineProps<{
  expanded: boolean;
}>();

defineEmits<{
  toggle: [];
}>();
</script>
```

**File:** `editor/src/components/EditorApp.vue`

Add panel to header and wire up v-model bindings.

**Effort:** 4-5 hours (~1 day)

---

### Phase 4: Extract useFileIO Composable

**Goal:** Extract 200+ lines of file I/O logic from EditorApp.vue into a composable.

**Critical:** This happens AFTER Phase 3, so the composable includes global documentation logic.

#### 4.1 Create useFileIO Composable

**File:** `editor/src/composables/useFileIO.ts` (NEW)

**API Design:**
```typescript
export interface UseFileIOReturn {
  // State
  isLoading: Ref<boolean>;
  lastError: Ref<string | null>;

  // Actions
  importFile: (file: File) => Promise<MappingDocument | null>;
  exportToJson: (document: MappingDocument, metadata: EditorMetadata) => Blob;
  exportToHtml: (document: MappingDocument) => Blob;
  exportToMarkdown: (document: MappingDocument, useAbbrs: boolean) => Blob;
  exportToMap: (document: MappingDocument) => Blob;

  // Helpers
  validateJsonSchema: (json: unknown) => ValidationError[];
  detectFileFormat: (file: File) => 'map' | 'json' | 'unknown';
}

export function useFileIO(): UseFileIOReturn {
  // Implementation
}
```

#### 4.2 Extract Logic from EditorApp

**Functions to move:**
- `readFile()` → `importFile()`
- `downloadJson/Html/Markdown/Map()` → export functions
- JSON schema validation logic → `validateJsonSchema()`
- Format detection → `detectFileFormat()`

**Keep in EditorApp:**
- `init()` - still needs to call analysis
- `reset()` - still needs to clear UI state
- Download triggering - calls composable export functions

#### 4.3 Update EditorApp.vue

Replace file reading logic:
```typescript
const {
  isLoading,
  lastError,
  importFile,
  exportToJson,
  exportToHtml,
  exportToMarkdown,
  exportToMap
} = useFileIO();

async function handleFileUpload(file: File) {
  const document = await importFile(file);
  if (document) {
    mappingDocument.value = document;
    init();
  }
}

function downloadJson() {
  const blob = exportToJson(mappingDocument.value, {
    rowColors: rowColors.value,
    rowComments: rowComments.value,
    globalComment: mappingDocument.value.globalComment,
    author: mappingDocument.value.author,
    version: mappingDocument.value.version
  });
  downloadBlob(blob, fileName.value + '.json');
}
```

**Effort:** 8-10 hours (~2 days)

---

### Phase 5: Extract usePanelLayout Composable

**Goal:** Eliminate prop drilling and centralize panel positioning logic.

#### 5.1 Create usePanelLayout Composable

**File:** `editor/src/composables/usePanelLayout.ts` (NEW)

**API Design:**
```typescript
interface PanelConfig {
  key: string;
  visible: boolean;
  expanded: boolean;
  storageKey: string;
}

interface PanelPosition {
  top: number;
  height: number;
}

export interface UsePanelLayoutReturn {
  // Panel state
  panels: {
    settings: PanelConfig;
    selectionToolbar: PanelConfig;
    midiMonitor: PanelConfig;
    variableMonitor: PanelConfig;
    warningLog: PanelConfig;
  };

  // Computed positions
  positions: ComputedRef<Record<string, PanelPosition>>;

  // Actions
  togglePanel: (key: string) => void;
  setVisible: (key: string, visible: boolean) => void;
  setExpanded: (key: string, expanded: boolean) => void;
}

export function usePanelLayout(): UsePanelLayoutReturn {
  // Implementation with localStorage persistence
  // Position calculation based on panel states
}
```

#### 5.2 Update EditorApp.vue

Replace 10 state variables with composable:
```typescript
const { panels, positions, togglePanel, setVisible } = usePanelLayout();
```

#### 5.3 Update Panel Components

Pass computed positions instead of upstream states:
```vue
<SettingsPanel
  :style="{ top: positions.settings.top + 'px' }"
  :expanded="panels.settings.expanded"
  @toggle="togglePanel('settings')"
/>
```

**Effort:** 6-8 hours (~1-2 days)

---

### Phase 6: SelectionToolbar Enhancement

**Goal:** Convert SelectionToolbar to use BasePanel, make it dockable.

**Benefits from:** usePanelLayout refactoring (easier to add to panel system).

**File:** `editor/src/components/SelectionToolbar.vue`

Convert to use BasePanel wrapper and integrate with usePanelLayout.

**Effort:** 3-4 hours (~0.5 days)

---

## Verification & Testing

### After Phase 1: Short-Term Wins
- [ ] Toasts appear for all file operations
- [ ] All buttons use MenuButton or IconButton
- [ ] TypeDoc comments generate proper documentation

### After Phase 2: Row Value Display
- [ ] Select a row → values display correctly in hex/dec/bin
- [ ] Progress bars show correct percentages
- [ ] Values update when row changes

### After Phase 3: Global Documentation
- [ ] Add global comment → save as JSON → reload → comment restored
- [ ] Global docs NOT in .MAP binary export
- [ ] Backward compatible with old JSON files (missing fields)

### After Phase 4: useFileIO Refactoring
- [ ] Import .MAP file works
- [ ] Import .JSON file works (old and new format)
- [ ] Export all formats works
- [ ] Error handling shows toasts/alerts correctly
- [ ] Global documentation preserved in export/import

### After Phase 5: usePanelLayout Refactoring
- [ ] All panels position correctly
- [ ] Panel visibility persists in localStorage
- [ ] Expanding/collapsing panels updates layout
- [ ] No prop drilling in template

### After Phase 6: SelectionToolbar Enhancement
- [ ] Toolbar uses BasePanel
- [ ] Docks next to Variables panel
- [ ] Shows for single selections too

---

## Risk Mitigation

### Phase 1: Short-Term Wins
- **Risk Level:** Low
- **Impact:** Isolated changes, no architectural impact
- **Testing:** Manual verification of toasts and buttons

### Phase 2: Row Value Display
- **Risk Level:** Low
- **Impact:** Additive feature, no breaking changes
- **Testing:** Manual verification with different row types

### Phase 3: Global Documentation
- **Risk Level:** Medium
- **Impact:** Modifies file format (JSON only)
- **Mitigation:** Backward compatibility for missing fields
- **Testing:** Import old JSON files, verify no errors

### Phase 4: useFileIO Refactoring
- **Risk Level:** High
- **Impact:** Touches critical file I/O logic
- **Mitigation:** Incremental extraction, extensive testing
- **Testing:** Import/export all file types, edge cases

### Phase 5: usePanelLayout Refactoring
- **Risk Level:** Medium
- **Impact:** Structural change affecting 5 components
- **Mitigation:** Test panel positioning thoroughly
- **Testing:** All panel combinations, localStorage persistence

### Phase 6: SelectionToolbar Enhancement
- **Risk Level:** Low
- **Impact:** UI enhancement only
- **Testing:** Manual verification of toolbar behavior

---

## Timeline Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| 1. Short-term wins | 7-10 hours | 1-2 days |
| 2. Row Value Display | 2-3 hours | 0.5 days |
| 3. Global Documentation | 4-5 hours | 1 day |
| 4. useFileIO Refactoring | 8-10 hours | 2 days |
| 5. usePanelLayout Refactoring | 6-8 hours | 1-2 days |
| 6. SelectionToolbar Enhancement | 3-4 hours | 0.5 days |
| **Total** | **30-40 hours** | **5-7 days** |

---

## Success Criteria

- [ ] EditorApp.vue reduced from ~1700 lines to ~1000-1200 lines
- [ ] All file I/O logic in composable (testable independently)
- [ ] No prop drilling for panel positioning
- [ ] Toast notifications improve UX feedback
- [ ] Consistent button styling across app
- [ ] Global documentation enhances mapping sharing
- [ ] All existing functionality preserved
- [ ] No breaking changes to .MAP binary format

---

## Next Steps After Implementation

Once these refactorings are complete, the codebase will be in excellent shape for:
- **Simulation Engine** (clean architecture for complex feature)
- **Breakpoints & Debugging** (benefits from clean separation)
- **Future: Draggable/Dockable Panels** (usePanelLayout makes this easier)

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

2026-01-25 - Integrated comprehensive implementation plan with phased approach

---
