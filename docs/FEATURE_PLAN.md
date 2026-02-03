# NerdSEQ Mapping Editor - Debugger & Monitoring System

## Overview

A simulation and debugging system for the Mapping Editor that allows users to validate, visualize, and test their mappings without uploading to hardware. Since execution happens on the NerdSEQ at 1kHz, this debugger focuses on **simulation, validation, visualization, and MIDI monitoring**.

---

## Completed Features are marked with ✅

# Bugs and improvements

## Fixed Bugs ✅

- ✅ **Comments not moving with rows** - Fixed by updating `useClipboard.ts` to swap comments in `swapRowContents()` function. Comments now follow rows when moved up/down.

- ✅ **Destination Skip functions different from source** - Unified encoding to match source (96 functions, same 6 conditions × 16 skip counts). Changed SkipDestinationExtra.vue to two-dropdown pattern.

- ✅ **Destination extra fields ignored Hex/Dec setting** - Fixed. Row index fields in Skip Destination Extra now respect `displayRowIndexAsHex` setting.

- ✅ **Lock function doesn't block all clear operations** - Fixed:
  - Delete/Backspace keyboard shortcuts now check lock state
  - Reset button now disabled when locked and checks lock state
  - RowCommentSection clear buttons now disabled when locked

- ✅ **Analyzer warnings don't adapt to Hex/Dec setting** - Fixed. `useStaticAnalyzer` now accepts `displayRowIndexAsHex` ref and formats all row indices in warning messages accordingly. Analysis re-runs when setting toggles.

## Known Bugs - Needs Investigation

- ⚠️ **Extra field reset when function changes within same type** - DEFERRED

  **Problem**: When changing a function within the same type (e.g., Skip 2 → Skip 3 rows, or Calc Add → Calc Subtract), the extra field is unconditionally reset to EMPTY_KEY, losing user's parameter values.

  **Current behavior**:

  ```
  User sets: Skip 2 Rows If Param1 > Param2
             Extra: Constant 5, Variable A

  User changes to: Skip 3 Rows If Param1 > Param2
             Extra: (empty) ← LOST!

  Expected: Extra should remain "Constant 5, Variable A"
  ```

  **Root cause location**: `EditorApp.vue`
  - Line ~1086: `sourceFunctionSelectionChanged()` unconditionally resets `row.source.extra`
  - Line ~1138: `destinationFunctionSelectionChanged()` unconditionally resets `row.destination.extra`

  **Why this happens**: The function change handlers always create a new empty `SourceExtra` or `DestinationExtra` object, regardless of whether the new function uses the same extra field structure.

  **Impact**:
  - Annoying UX: User must re-enter extra parameters when switching functions
  - NerdSEQ export issue: Hardware expects extras to be preserved across function changes within the same type
  - Affects: Calc type (all functions share same extra), Skip type (all functions share same extra)
  - Does NOT affect: Changing between different types (CV → MIDI) - reset is correct in that case

  **Why deferred**:
  - This feels like a symptom rather than root cause
  - Need to investigate the broader pattern of how type/function/extra relationships are managed
  - May indicate architectural issue with how the UI binds to the document model
  - Quick fix would be preserving extras conditionally, but that doesn't address why the binding breaks

  **Proposed investigation areas**:
  1. Why does changing the function dropdown trigger a full extra reset?
  2. Should the extra field be truly independent or derive from function selection?
  3. Is the v-model binding on extra fields reactive enough?
  4. Could the extra components manage their own state better?
  5. Should there be a "preserve on function change" flag in the type definition?

  **Potential approaches** (for future fix):
  - **Quick fix**: Conditionally preserve extra when changing functions within same type
  - **Better fix**: Refactor function/extra binding to maintain state unless type changes
  - **Best fix**: Investigate why function change triggers extra reset in first place - may reveal deeper architectural issue

  **Workaround for users**: Re-enter extra parameters after changing functions. Values are preserved in NerdSEQ after export if set before saving.

### Phase 0.1 - Convinience features for Copy paste and row selection

- Add the option to select a single row without opening the comment section.
  - The comment section is initally opened. Close the comment section if a row is selected and you click on it again.
  - If you click a third time the row will be deselected
  - This state is saved and if you select another row, the comment section is also closed or opened,
    dependent on the last toggle state.
- after a row paste action automatically select the next row, to be able keep on pasting. only add this paste fall through if i paste a whole row!
- Add fall through option after Midi learn as well. Select the next row with
  - add a settings checkbox to unselect that option.

### search for references

- include a option to search for references and how often they are used. (maybe a later feature)

### Phase 0.11 - Visual additions

- Add middle Row which conatains > or X dependent on, if the row will be executed or not
  -> later i want this to be part of the debugger. But for now only add visual feedback from static analysis
  - make a comprehensive plan for this first.
- make columns Source Type, source Function, source Extras resizable, by pulling and pushing on the column borders between source type and source function and between source Function and source Extra. Keep the Row number and ● in place. -> Do the same for the Destination Side, here use ● and the Clear column as fixed.
  -> This will give the user the capability to see the text of the columns if the text is too long and wraped by the borders. keep the current style of the boxes. I like it, only add the capability to resize to read the text.

### 0.12 Description window Enhancement

- merge description/GlobalComment window with input filename field.
  -> make a plan for this first.
- Add a Shortcut for toggeling between windows

### 0.13 - Bugfixes

- Check if you switch source function from variable to row, if the source extra gets updated.
  --> found a bug, where the source extra was not updated right because it still was set to From Row/Var but it wasnt recognized after exporting to Nerdseq. I think it still was ticked in the Editor which caused it not to update this field. (clarify this is not a propper description)

### Phase 0.2 - A/B Caching System ✅

- **A/B slot caching** with IndexedDB persistence (`useMappingCache.ts`)
- **Lock function per slot** - prevents accidental modifications
- Clear indicator showing which slot (A/B) is active

### Phase 1.1 - Static Logic Analyzer ✅

- Automated analysis on load/save (`useStaticAnalyzer.ts`)
- Warning types: Variable Read Before Write, Destination Conflicts, Unused Variables
- Warning count badge in header toolbar

### Phase 1.2 - Warning Annotations (partly implemented)

- Warnings displayed in RowCommentSection when row selected
- Yellow/orange warning badges
- Warning Log panel (`useWarningLog.ts`)
- Add subfolding for warnings which contain several references.

### Phase 4.1-4.3 - Multi-Selection & Row Colors ✅

- **Shift+Click** range selection
- **Ctrl/Cmd+Click** individual toggle
- **Multi-Selection Toolbar** (`SelectionToolbar.vue`)
- **Background color options** for visual grouping (8 colors)
- Row move with conflict detection

### Infrastructure Improvements ✅

- **BasePanel component** - unified foldable panel styling
- **MenuButton component** - consistent button styling
- **ToastNotifications** - transient notification system
- **Variable Monitor** - basic variable display panel

---

## Phase 0.1 Selection Toolbar Enhancement

- Convert multi-selection toolbar to BasePanel-based component
- Make visible for single selections too
- Dock initially next to Variables view

### Advanced (Future):

- Draggable panels with "::" handle
- Docking functionality (like Minimeters)

---

## Phase 1: Foundation (Remaining)

### 1.3 Row Value Display in Comment Section

Show hex, decimal, and binary values of the currently selected row (matching NerdSEQ mapping menu style):

```
Row 12 - Value Monitor
----------------------------
Source Value:  2048  |  0x0800  |  0b100000000000
Dest Value:    1024  |  0x0400  |  0b010000000000
                     [████████░░░░░░░░] 50%
```

### 1.4 Global Mapping Documentation

Add a collapsible textarea in the header for mapping-level documentation:

```typescript
interface MappingDocumentHeader {
  // ... existing fields
  globalComment?: string; // Markdown-supported description
  author?: string;
  version?: string;
  changelog?: string[];
}
```

- Supports basic Markdown formatting
- Saved in .JSON format (not in binary .MAP due to space constraints)
- Collapsible to save screen space
- Can reference external .md files for complex documentation

---

## Phase 2: Simulation Engine

### 2.1 Virtual Execution Engine

JavaScript-based simulation that executes the 70 mapping rows sequentially:

**Core Features:**

- Configurable execution speed (1Hz to 1kHz via slider/potentiometer)
- Mock data sources for CV inputs, MIDI messages, Track states
- Variable state management across cycles
- Skip/Calc condition evaluation
- Value transformation (min/max/offset scaling)
- Internal tick clock matching NerdSEQ (6 ticks per step)

**Timing Reference:**

- Based on NerdSEQ manual: 6 ticks per step
- BPM clock in header section for tempo synchronization
- Reference: https://xor-electronics.com/forum/attachment.php?aid=628

**Supported Source Types (MVP):**

- [x] Variable (read from state)
- [x] Calc (arithmetic operations)
- [x] Skip (conditional logic)
- [x] MIDI CC (from mock or live input)
- [ ] CV (from mock input)
- [ ] Track (from mock state)
- [ ] Automator, Envelope, etc. (Phase 3)

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                    Simulation Engine                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Mock Input  │  │   Executor  │  │  State Manager  │ │
│  │ Generator   │──│  (per row)  │──│  (Variables)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│         │                │                   │          │
│         └────────────────┼───────────────────┘          │
│                          ▼                              │
│                 ┌─────────────────┐                     │
│                 │  Output Values  │                     │
│                 │  (per row/dest) │                     │
│                 └─────────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Execution Visualizer (Running Light)

Visual indicator showing the current row position during simulation, similar to the NerdSEQ sequencer running light:

**Running Light Behavior:**

- Highlight active row in Row column with yellow background
- **Do NOT expand the comment section** when running light passes
- Only show as visual indicator on the row number area
- Skipped rows briefly flash gray
- Match the sequencer rectangle animation style

**CSS Classes:**

```css
.row-executing {
  background: rgba(255, 193, 7, 0.3); /* Yellow highlight */
}
.row-skipped {
  background: rgba(108, 117, 125, 0.2);
  opacity: 0.6;
}
.row-breakpoint-marker {
  border-left: 4px solid #dc3545;
}
.row-breakpoint-hit {
  background: rgba(220, 53, 69, 0.3);
}
```

### 2.3 Transport Controls & Speed Slider

Add transport controls in header section:

| Control    | Icon | Shortcut | Description              |
| ---------- | ---- | -------- | ------------------------ |
| Play       | ▶   | Space    | Start/resume simulation  |
| Pause      | ⏸   | Space    | Pause at current row     |
| Stop       | ⏹   | Escape   | Stop and reset to row 0  |
| Step       | ⏭   | F10      | Execute one row          |
| Step Cycle | ⏩   | F11      | Execute all 70 rows once |
| Continue   | ▶➡ | F5       | Run to next breakpoint   |

**Speed Control (Slider/Poti):**

- Logarithmic slider: 1Hz → 10Hz → 100Hz → 1000Hz
- Visual potentiometer style matching NerdSEQ aesthetic
- Allows slow-motion debugging at 1Hz for learning

**BPM Clock:**

- BPM input field in header section
- Calculate tick interval: `tickInterval = 60000 / (BPM * 6)` ms
- Syncs simulation to musical timing (6 ticks per step)
- Display current tick count and cycle info

---

## Phase 3: Breakpoints & Debugging

### 3.1 Arrow Indicator Column with Breakpoints

**Add a status/breakpoint column between Source Extra and Destination Type:**

This column serves dual purpose:

1. **Status indicator** - Shows `>` (active/executed) or `X` (skip type)
2. **Breakpoint control** - Click to open dropdown menu, shapes indicate breakpoint type

```
┌─────────────┬───┬───────────────┐
│ Source Extra│ → │ Dest Type     │
├─────────────┼───┼───────────────┤
│ Channel 1   │ > │ CV Out 1      │  ← No breakpoint
│ Value: 100  │(>)│ MIDI CC 7     │  ← Unconditional (circle)
│ [Empty]     │△> │ [Empty]       │  ← Conditional (triangle)
│ Skip if >   │[X]│ Skip          │  ← Hit count (rectangle)
└─────────────┴───┴───────────────┘
```

**Status Symbols:**

| Symbol | Color          | Meaning                                        |
| ------ | -------------- | ---------------------------------------------- |
| `>`    | Teal (#34cc99) | Active/Executed - includes empty rows          |
| `X`    | Red (#dc3545)  | Skip type - row has Skip source or destination |

**Note:** Empty rows show `>` because they are still executed by NerdSEQ.

**Breakpoint Shapes (around the > or X symbol):**

| Shape       | Background Color               | Meaning                                |
| ----------- | ------------------------------ | -------------------------------------- |
| None        | Default                        | No breakpoint                          |
| Circle ○    | Red rgba(220, 53, 69, 0.3)     | Unconditional - always pause           |
| Triangle △  | Orange rgba(253, 126, 20, 0.3) | Conditional - pause if expression true |
| Rectangle □ | Yellow rgba(255, 193, 7, 0.3)  | Hit Count - pause after N executions   |

**UI Interactions:**

- Click on `>` or `X` → Opens dropdown menu with breakpoint options
- Dropdown shows: No Breakpoint, Unconditional, Conditional, Hit Count
- Background color and shape change based on selected breakpoint type

**Breakpoint State:**

```typescript
interface RowBreakpoint {
  type: "none" | "unconditional" | "conditional" | "hitCount";
  condition?: string; // e.g., "source.value > 2000"
  hitCount?: number; // pause after N hits
  currentHits?: number; // tracking current hit count
}
```

**Skip Detection Logic:**

```typescript
function isRowSkipped(row: MappingRow): boolean {
  const SKIP_SOURCE_TYPE = 11;
  const SKIP_DEST_TYPE = 15;
  return (
    row.source.type.key === SKIP_SOURCE_TYPE ||
    row.destination.type.key === SKIP_DEST_TYPE
  );
}
```

**CSS Implementation:**

```css
.arrow-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  cursor: pointer;
  width: 30px;
}
.arrow-active {
  color: #34cc99;
}
.arrow-skipped {
  color: #dc3545;
}

/* Breakpoint shapes */
.arrow-cell.bp-unconditional {
  background: rgba(220, 53, 69, 0.3);
  border: 2px solid #dc3545;
  border-radius: 50%; /* Circle */
}
.arrow-cell.bp-conditional {
  background: rgba(253, 126, 20, 0.3);
  border: 2px solid #fd7e14;
  /* Triangle via clip-path */
}
.arrow-cell.bp-hitcount {
  background: rgba(255, 193, 7, 0.3);
  border: 2px solid #ffc107;
  border-radius: 2px; /* Rectangle */
}
```

### 3.2 Row Value Monitor

Display real-time values in RowCommentSection during simulation:

```
Row 12 - MIDI CC Source
───────────────────────────────────────────────
Source:   2048  |  0x0800  |  0b100000000000
          [████████████░░░░░░░░] 50%

Dest:     1024  |  0x0400  |  0b010000000000
          [██████░░░░░░░░░░░░░░] 25%

Last Update: Cycle 1247 (0.5s ago)  ↑ Rising
```

**Features:**

- Decimal, hex, and binary representation (matching NerdSEQ mapping menu)
- Visual progress bar (0-4095 range)
- Percentage of full range
- Last update timestamp with cycle number
- Value change indicator (↑ rising, ↓ falling, → stable)

### 3.3 Variable Monitor Enhancements ✅

Extended the existing VariableMonitor component with advanced debugging features:

| Feature | Description | Status |
|---------|-------------|--------|
| Unused Variables | Grey out variables not used in mapping | ✅ |
| Value Format Toggle | Switch between DEC/HEX/BIN/BOOL display | ✅ |
| Row Writers Display | Show which rows write to each variable | ✅ |
| Visual Status | Border colors: read (teal), written (brighter) | ✅ |

**Implementation:**
- New composable: `useVariableUsage.ts` - tracks variable reads/writes across all rows
- Enhanced VariableMonitor with toggle controls and conditional styling
- LocalStorage persistence for user preferences

**Value Formats:**
- **Decimal**: `0` to `4095` (default)
- **Hexadecimal**: `0x000` to `0xFFF`
- **Binary**: `0b000000000000` to `0b111111111111` (12-bit)
- **Boolean**: `0` (false) or `1` (true for any non-zero)

**Visual Indicators:**
- **Greyed out**: Variable not read or written (opacity 0.3)
- **Teal border**: Variable is read
- **Brighter background**: Variable is written
- **Writers list**: Shows row indices (e.g., "5, 12, 34")

**Features (Future):**
- Reads column: which rows are reading the variable
- Last Write timestamp: when variable was last updated

### 3.4 Row Values Submonitor in Variable Monitor

**Status:** 📋 Planned

Add a collapsible "Rows" section within the Variable Monitor that displays destination output values for all 70 mapping rows.

**Features:**
- **Always-present collapsible section** below variables (not a display mode button)
- **Format integration**: Row values respond to DEC/HEX/BIN/BOOL buttons (same as variables)
- **Independent scrolling**: Variables fixed at top, rows section scrolls separately
- **Collapsible divider**: Click "Rows" header to expand/collapse (like SettingsPanel pattern)
- **Destination display**: Shows destination type and function for each row
- **Row index format**: Respects hex/dec setting from Settings panel
- **LocalStorage persistence**: Expansion state persists across sessions
- **Readers display mode**: Optional toggle to show which rows are reading/referencing each row (cross-reference visualization)

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Variables Monitor                   │
├─────────────────────────────────────┤
│ [DEC] [HEX] [BIN] [BOOL]           │ ← Format buttons
│ [Values] [Writers] [Readers]        │ ← Display mode (affects variables only)
├─────────────────────────────────────┤
│ A: 128    I: 0                      │ ← Variables section (fixed)
│ B: 1870   J: 0                      │
│ ...                                  │
├─────────────────────────────────────┤
│ ▸ Rows                              │ ← Collapsible divider
├─────────────────────────────────────┤
│ 00: CV Out1      0x0                │ ← Rows section (scrollable)
│ 01: MIDI CC7     0x7                │
│ 02: SetVar A     0xA                │
│ ...                                  │
│ 69: [Empty]      —                  │
└─────────────────────────────────────┘
```

**Value Formatting Examples:**
- **Decimal**: `00: CV Out1     5`
- **Hexadecimal**: `00: CV Out1     0x005`
- **Binary**: `00: CV Out1     0b000000000101`
- **Boolean**: `00: CV Out1     1`

**Readers Display Mode:**

Add a toggle button `[Readers]` alongside the format buttons to switch between value display and readers display:

```
┌─────────────────────────────────────┐
│ Variables Monitor                   │
├─────────────────────────────────────┤
│ [DEC] [HEX] [BIN] [BOOL]           │ ← Format buttons
│ [Values] [Writers] [Readers]        │ ← Display mode
├─────────────────────────────────────┤
│ ▼ Rows                              │
├─────────────────────────────────────┤
│ 00: CV Out1      ← 12, 35, 47       │ ← Shows row indices that reference row 0
│ 01: MIDI CC7     —                  │ ← No readers
│ 02: SetVar A     ← 03               │ ← Row 3 references row 2
│ 05: Skip         ← 01, 08           │ ← Rows 1 and 8 skip to row 5
│ ...                                  │
└─────────────────────────────────────┘
```

**Cross-Reference Detection:**

The system should detect rows that reference other rows through:
- **Skip Source/Destination**: Rows that skip to a specific row index
  - Skip conditions with target row parameters
  - Skip N rows calculations that land on specific rows
- **Calc Operations**: Rows using other row values in calculations (if supported)
- **Variable chains**: Rows that write variables read by other rows (indirect references)
- **Future**: Any other row-to-row reference mechanisms

**UI Behavior:**
- **Click on reader index**: Jump to and select that row in main editor
- **Hover**: Show tooltip with source type and function of the referencing row
- **Color coding**: Match row colors from main editor for visual consistency
- **Empty state**: Show "—" or "No readers" when no rows reference this row
- **Multiple readers**: Show comma-separated list (e.g., "12, 35, 47")
- **Many readers**: If >5 readers, show count: "← 7 rows" with expandable detail

**Row Index Format:**
- Respects hex/dec setting from Settings panel
- Decimal mode: `← 5, 12, 35`
- Hex mode: `← 0x05, 0x0C, 0x23`

**Implementation Details:**
- `RowLike` interface for type safety
- `formatRowDestination()` - formats destination info
- `getDestinationValue()` - formats values using current `valueFormat`
- `getRowReaders()` - returns array of row indices that reference a specific row
- Panel width: 300px (consistent across all modes)
- Rows subsection state: `rowsSubsectionExpanded` (localStorage: `variable-rows-subsection-expanded`)
- Display mode state: `rowsDisplayMode: 'values' | 'readers'` (localStorage: `variable-rows-display-mode`)

**New Service Required:**
- `rowReferenceService.ts` - Analyzes all rows to build reference graph
  - `buildReferenceMap(rows: Row[]): Map<number, number[]>` - Maps row index → reader row indices
  - `getReaders(rowIndex: number): number[]` - Returns rows that reference this row
  - `getReferencedRows(rowIndex: number): number[]` - Returns rows this row references
  - Detects Skip source/destination row references
  - Detects Calc operations using row values (if applicable)
  - Cached and invalidated on row changes

**Files to Modify:**
1. `editor/src/services/rowReferenceService.ts` (NEW, ~150 lines)
   - Implement row reference analysis and tracking
   - Build and maintain reference graph
   - Provide reader/reference lookup methods
2. `editor/src/components/VariableMonitor.vue` (~180 lines)
   - Add rows section state and formatting functions
   - Add display mode toggle (Values/Readers)
   - Add rows subsection template with collapsible divider
   - Integrate rowReferenceService for readers display
   - Add click handlers for reader navigation
   - Add rows subsection styles
3. `editor/src/components/EditorApp.vue` (~5 lines)
   - Pass `:rows="mappingDocument.rows"` prop
   - Import and provide rowReferenceService
   - Add handler for row navigation from readers click

**Future Enhancements:**
- Computed output values based on source input + min/max/offset scaling
- Filter to show only rows with active destinations
- Highlight row dependencies in a graph visualization
- Export reference map as documentation
- Show reference chains (row A → row B → row C)
- Warning indicators for circular references
- Statistics: most/least referenced rows

**Design Plan:** `/Users/pforsten/.claude/plans/structured-brewing-dragon.md`

## Phase 4: Multi-Selection & Row Management

> **Note:** Phases 4.1-4.3 are implemented. See "Completed Features" section above.

### 4.4 Drag-and-Drop Row Reordering (Single Row)

Enable mouse-based row reordering via drag and drop for **single row selection only**:

**Behavior:**

- Drag handle visible on row index column (hover to reveal)
- **Only enabled when exactly 1 row is selected**
- Multi-row selection continues to use Move Up/Down buttons in toolbar
- Visual feedback: ghost row while dragging, drop zone highlights

**Implementation:**

- HTML5 Drag and Drop API
- Reuse `swapRowContents()` and `swapSelectedTypes()` from useClipboard.ts
- Animate row transitions for smooth UX

**Keyboard Alternative:**

- Alt+Up/Down to move selected row (single selection only)

**Visual Feedback:**

```
┌─────┬───────────────────────────────┐
│  5  │ MIDI CC 7 → CV Out 1         │
├─────┼───────────────────────────────┤
│ ⋮⋮⋮ │ [Dragging: Row 6]            │  ← Ghost row
├ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤  ← Drop zone indicator
│  7  │ Variable A → SetVar B        │
└─────┴───────────────────────────────┘
```

---

## Phase 5: MIDI Integration

### 5.1 MIDI Live Monitor Integration

Extend existing MIDI monitoring to show mapping correlations:

**Trace Mode:**

- Toggle in MidiMonitor header
- When enabled, incoming MIDI highlights matching rows
- Shows predicted destination values in tooltip

**Row Highlighting:**

```
MIDI CC 7 = 64 received
  └─→ Row 5 matches (MIDI CC source = 7)
      └─→ Predicted output: CV Out 2 = 1024
```

### 5.2 Virtual MIDI Ports

Create virtual MIDI ports from the editor for DAW/software integration:

**Features:**

- Virtual input port: Editor receives MIDI from DAW
- Virtual output port: Editor sends simulated outputs
- Cross-platform support (WebMIDI API where available)
- Fallback to loopback utilities (loopMIDI, IAC Driver)

**Use Cases:**

- Test mappings with DAW automation
- Record MIDI output from simulation
- Integrate with Max/MSP, Pure Data, VCV Rack

### 5.3 MIDI Test Injection

Allow manual MIDI message injection for testing:

- Button to send test MIDI CC/Note/NRPN
- Slider for quick value testing
- Integration with simulation engine

---

## Phase 6: Advanced Features (Future)

### 6.1 Execution History & Timeline

- Record last 100 cycles with full state snapshots
- Timeline scrubber to "rewind" and inspect past states
- Diff view comparing cycle N vs cycle M
- Export history as JSON

### 6.2 Dependency Graph Visualizer

- Visual flowchart showing data flow through mappings
- Nodes: Sources, Destinations, Variables
- Edges: Row connections
- Highlight cycles, dead ends, critical paths
- Export as SVG/PNG for documentation

### 6.3 Performance Profiler

- Measure execution time per row (in simulation)
- Identify rows with complex calculations
- Optimization suggestions

### 6.4 Comprehensive Action Logging & Undo System

**Status:** ✅ Designed - Ready for Implementation

A comprehensive undo/redo system with **per-slot history** and **IndexedDB persistence**. Each A/B slot maintains independent undo/redo stacks that survive page refresh.

---

#### Architecture: Command Pattern + Per-Slot History

**Core Design:**

- **Hybrid Command Pattern**: Each operation implements `execute()` and `undo()`
- **Slot-Aware Singleton**: `useActionHistory` composable manages two independent stacks (Slot A, Slot B)
- **Automatic Context Switching**: Active undo stack switches when user switches slots
- **IndexedDB Persistence**: Undo history survives page refresh via command serialization
- **Lock Protection**: Locked slots preserve history but prevent undo/redo operations

**Mental Model:**

```
Slot A (Active)                    Slot B (Inactive)
├─ MappingDocument A               ├─ MappingDocument B
├─ Undo Stack A [5 actions]        ├─ Undo Stack B [3 actions]
├─ Redo Stack A [empty]            ├─ Redo Stack B [1 action]
└─ Lock: Unlocked ✓                └─ Lock: Locked 🔒
```

When switching to Slot B:

- Active stack switches to Slot B's undo/redo
- Undo buttons show Slot B's last action
- Slot A history preserved but inactive

---

#### Key Features

**✅ Per-Slot Independent History**

- Each slot maintains separate undo/redo stacks (max 50 actions each)
- History preserved when switching between slots
- No cross-slot contamination

**✅ Persistent Across Page Refresh**

- Undo history saves to IndexedDB automatically (debounced 500ms)
- Commands serialize to JSON with metadata
- Reconstruction on page load with proper refs

**✅ Lock-Aware Behavior**

- Locked slots: `canUndo = false`, `canRedo = false`
- `executeCommand()` returns error: "Slot X is locked"
- History preserved when locked, restored when unlocked

**✅ Clean File Loads**

- Loading a new file clears that slot's undo history
- Persists cleared state to IndexedDB

**✅ Incremental Rollout (4 Phases)**

- Phase 1: Logging only (foundation)
- Phase 2: Simple undo (colors, comments)
- Phase 3: Complex undo (row operations, moves)
- Phase 4: Full UI with history viewer

---

#### Implementation Details

**Command Interface:**

```typescript
interface Command {
  execute(): void;
  undo(): void;
  getDescription(): string;
  getMetadata(): CommandMetadata;
  toJSON(): SerializedCommand; // For persistence
}
```

**Concrete Commands:**

- `SetRowColorCommand` - Undo color changes
- `SetRowCommentCommand` - Undo comment edits
- `PasteRowCommand` - Undo paste with full row snapshots
- `MoveRowsCommand` - Undo moves with reference tracking
- `BatchCommand` - Composite for multi-row operations
- `SetVariableValueCommand` - Undo variable slider changes

**Composable API:**

```typescript
const {
  canUndo,    // Reflects active slot + lock state
  canRedo,
  executeCommand,  // Operates on active slot
  undo,
  redo,
  clearCurrentHistory
} = useActionHistory({
  activeSlot,    // From useMappingCache
  isLockedA,
  isLockedB,
  context: { mappingDocument, rowColors, ... }
});
```

**UI Elements:**

- Undo/Redo buttons in toolbar with slot indicators
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
- ActionHistoryPanel showing both slots with tab toggle
- Tooltips: "[Slot A] Set row 5 color to red"

---

#### IndexedDB Persistence

**Storage Schema:**

```typescript
interface SerializedSlotHistory {
  slotId: "A" | "B";
  undoStack: SerializedCommand[];
  redoStack: SerializedCommand[];
  lastModified: number;
}
```

**Keys:**

- `undo-history-A` → Slot A undo/redo stacks
- `undo-history-B` → Slot B undo/redo stacks

**Memory Budget:**

- 50 actions × ~300 bytes = ~15KB per slot
- **Total: ~30KB for both slots** (negligible storage)

**Serialization:**

- Commands implement `toJSON()` for serialization
- `fromJSON()` static method reconstructs with deserialization context
- Non-serializable refs (mappingDocument, rowColors) provided on restoration

---

#### Rollout Plan

**Phase 1: Foundation (Week 1)**

- Create `useActionHistory.ts` with slot awareness
- Implement command serialization interface
- Add logging mode (no undo yet)
- Test persistence across page refresh

**Phase 2: Simple Undo (Week 2)**

- Implement color/comment commands with undo
- Add Undo/Redo buttons (disabled when locked)
- Add keyboard shortcuts
- Test slot switching during undo/redo

**Phase 3: Complex Undo (Weeks 3-4)**

- Implement row operation commands
- Test row moves with reference tracking
- Batch commands for multi-row operations
- Refactor useClipboard to use commands

**Phase 4: Full UI (Week 5)**

- ActionHistoryPanel with slot tabs
- Show lock indicators per slot
- Jump-to-state feature
- Performance testing (100 total actions)

---

#### Benefits

**For Users:**

- Experiment freely knowing undo is available
- Each slot = independent workspace with its own history
- Locked slots protected from both edits AND accidental undo
- History survives browser refresh

**For Development:**

- Easily extendable - new commands are ~50 lines of code
- Testable - command pattern enables unit tests
- Non-invasive - incrementally wrap existing operations
- Leverages existing architecture (Vue reactivity, singleton composables)

---

#### Testing Strategy

**Per-Slot Test Cases:**

- Maintain separate undo stacks per slot
- Prevent undo when slot is locked
- Preserve redo stack when switching slots
- Restore history from IndexedDB on page load

**Integration Tests:**

- Undo color change, redo, verify state
- Undo paste operation, verify row restored
- Move rows, undo, verify references restored
- Lock slot, verify undo disabled, unlock, verify restored

---

#### Critical Files

**New Files:**

1. `editor/src/composables/useActionHistory.ts` (~250 lines) - Core composable with slot awareness
2. `editor/src/commands/Command.ts` (~150 lines) - Base interface + serialization
3. `editor/src/commands/SetRowColorCommand.ts` (~100 lines) - Example simple command
4. `editor/src/commands/MoveRowsCommand.ts` (~200 lines) - Example complex command
5. `editor/src/components/ActionHistoryPanel.vue` (~150 lines) - History viewer UI

**Modified Files:**

1. `editor/src/components/EditorApp.vue` (~120 lines changed) - Integration + UI
2. `editor/src/composables/useMappingCache.ts` (~10 lines) - Export slot state refs

---

#### Design Decisions (Confirmed)

1. **Persistence**: ✅ IndexedDB (history survives page refresh)
2. **File Load**: ✅ Clear slot history on file load
3. **Lock Behavior**: ✅ Preserve history, prevent undo/redo
4. **Cross-Slot**: ✅ Destination slot logs the action

---

#### Future Enhancements

- Persistent history export/import (JSON format)
- History diff viewer (compare states)
- Cross-slot copy operations with undo
- Action replay/macro recording
- Visual history timeline

---

**See `/Users/pforsten/.claude/plans/witty-wobbling-boot.md` for complete implementation specification with code examples, serialization details, and full API documentation.**

---

## Technical Considerations

### Simulation vs Hardware Reality

**Important:** The simulator cannot perfectly replicate NerdSEQ firmware behavior.

- Label clearly as "approximate simulation"
- Focus on logic validation (Skip conditions, Variable flow)
- Always recommend hardware testing for final validation
- Document known differences from hardware behavior

### NerdSEQ Timing Reference

From manual (nerdseq_manual_3_00.pdf):

- 6 ticks per step at current BPM
- 1kHz internal processing rate
- Mapping execution once per cycle

### Performance Targets

| Metric           | Target                   |
| ---------------- | ------------------------ |
| Simulation Speed | 1Hz to 1kHz (adjustable) |
| UI Update Rate   | 60fps (16ms)             |
| Memory (History) | Max 10MB for 100 cycles  |
| Startup Analysis | < 100ms for 70 rows      |

### Data Storage

| Data Type         | Storage Location           |
| ----------------- | -------------------------- |
| Breakpoints       | .json metadata             |
| Row comments      | .json metadata             |
| Global comment    | .json metadata             |
| Row colors        | .json metadata             |
| Warnings          | Runtime only (regenerated) |
| Execution history | Runtime only               |

---

## Implementation Roadmap

```
Phase 1 (Foundation)           Phase 2 (Simulation)
├── ✅ Static Analyzer         ├── Virtual Engine
├── ✅ Warning Annotations     ├── Running Light
├── Row Value Display          ├── Transport Controls
└── Global Documentation       └── Speed Slider + BPM
        │                               │
        ▼                               ▼
Phase 3 (Debugging)            Phase 4 (Selection)
├── Breakpoint Column          ├── ✅ Shift+Click Selection
├── Breakpoint Types           ├── ✅ Selection Toolbar
├── Row Value Monitor          └── ✅ Background Colors
└── Variable Monitor Enhancements
        │                               │
        ▼                               ▼
Phase 5 (MIDI)                 Phase 6 (Advanced)
├── Live Monitor Integration   ├── Execution History
├── Virtual MIDI Ports         ├── Dependency Graph
└── Test Injection             └── Performance Profiler
```

### Priority Order (Updated)

1. ~~**Static Logic Analyzer**~~ ✅ Implemented
2. ~~**Warning Annotations**~~ ✅ Implemented
3. **Row Value Display** - Hex/decimal/binary like NerdSEQ menu
4. **Global Documentation** - Quick win for community sharing
5. **Virtual Execution Engine** - Foundation for all debugging features
6. **Transport Controls + Speed Slider** - Enables debugging workflow
7. **Running Light** - Visual feedback (no comment expansion)
8. **Breakpoint Column & System** - Step-through debugging
9. ~~**Multi-Selection**~~ ✅ Implemented
10. **Virtual MIDI Ports** - DAW integration

---

## User Personas

### The Precision Mapper (Primary)

- Creates complex CV/MIDI routing
- Wants to validate logic before hardware upload
- Values: Static analysis, simulation, conditional debugging

### The Live Performer (Secondary)

- Uses NerdSEQ in live contexts
- Needs real-time feedback during performance
- Values: MIDI monitoring, visual execution indicators

### The Patch Librarian (Secondary)

- Maintains collections of mappings
- Shares patches with community
- Values: Documentation, warnings, export reports

---

## Open Questions

1. **Hardware Telemetry**: Can NerdSEQ send execution state back via MIDI SysEx?
2. **Tick Timing**: Verify 6 ticks per step across all firmware versions
3. **Variable Persistence**: Do variables persist across power cycles?
4. **Virtual MIDI**: Best cross-platform approach for virtual ports?
5. **Community Rules**: Could static analyzer rules be community-contributed?

---

## References

- NerdSEQ Manual v3.00: `/Users/pforsten/Downloads/PDFs/nerdseq_manual_3_00.pdf`
- XOR Electronics Forum: https://xor-electronics.com/forum/attachment.php?aid=628
- Mapping File Format: `/docs/mapping_file_definition.txt`
