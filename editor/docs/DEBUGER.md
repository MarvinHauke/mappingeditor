# NerdSEQ Mapping Editor - Debugger & Monitoring System

## Overview

A simulation and debugging system for the Mapping Editor that allows users to validate, visualize, and test their mappings without uploading to hardware. Since execution happens on the NerdSEQ at 1kHz, this debugger focuses on **simulation, validation, visualization, and MIDI monitoring**.

---

## Phase 1: Foundation (MVP)

### 1.1 Static Logic Analyzer

Automated analysis that scans all 70 rows on load/save and flags potential issues:

| Warning Type | Description | Example |
|--------------|-------------|---------|
| Variable Read Before Write | Variable used as source before any row sets it | "Variable B used in Row 12 but never set" |
| Skip Always True/False | Conditional logic that never changes | "Skip condition `1 == 1` always evaluates to TRUE" |
| Unreachable Rows | Rows after unconditional Skip | "Row 15-20 unreachable after unconditional Skip in Row 14" |
| Unused Variables | Variables set but never read | "Variable C set in Row 5 but never used" |
| Destination Conflicts | Multiple rows writing to same output | "CV Out 3 written by Row 8 and Row 22" |
| Out-of-Range Values | Offset + maxValue exceeds limits | "Row 7: offset 2000 + maxValue 3000 exceeds 4095" |

**Implementation:**
- Run analysis on document load, save, and on-demand via toolbar button
- Store warnings in reactive state per row
- Display warning count badge in header toolbar

### 1.2 Warning Annotations in Comment Section

Display warnings prominently in RowCommentSection when a row is selected:

```
Row 12 - MIDI CC Source
----------------------------
Source: MIDI CC 7 (Volume)
Destination: CV Out 3

[!] Variable B used but never set in previous rows
[!] Destination CV Out 3 also written by Row 22
```

**UI Treatment:**
- Yellow/orange badges for warnings
- Red badges for errors (critical issues)
- "Dismiss" option per warning (stored in JSON metadata)
- "Learn More" link explaining the warning

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
  globalComment?: string;  // Markdown-supported description
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
  background: rgba(255, 193, 7, 0.3);  /* Yellow highlight */
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

| Control | Icon | Shortcut | Description |
|---------|------|----------|-------------|
| Play | ▶ | Space | Start/resume simulation |
| Pause | ⏸ | Space | Pause at current row |
| Stop | ⏹ | Escape | Stop and reset to row 0 |
| Step | ⏭ | F10 | Execute one row |
| Step Cycle | ⏩ | F11 | Execute all 70 rows once |
| Continue | ▶➡ | F5 | Run to next breakpoint |

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

### 3.1 Breakpoint System

**Add breakpoint column between Row number and Copy/Paste buttons:**

```
┌─────┬────┬─────────┬──────────────────────────────────┐
│ Row │ BP │ Copy/   │  Source / Destination Config     │
│     │    │ Paste   │                                  │
├─────┼────┼─────────┼──────────────────────────────────┤
│  1  │ ●  │ [📋][📄] │  MIDI CC 7 → CV Out 3           │
│  2  │    │ [📋][📄] │  Variable A → SetVar B          │
│  3  │ ◐  │ [📋][📄] │  Skip if > 2000                 │
└─────┴────┴─────────┴──────────────────────────────────┘
      │
      └─ ● = Unconditional breakpoint
         ◐ = Conditional breakpoint
         ⑤ = Hit count breakpoint (shows count)
```

**Breakpoint Types:**
1. **Unconditional** - Always pause at this row (red dot ●)
2. **Conditional** - Pause if expression is true (half-filled ◐)
   - Example: `source.value > 2000`
   - Example: `variable.A < 100 AND cycle > 50`
3. **Hit Count** - Pause after N executions (number badge ⑤)

**UI Interactions:**
- Click breakpoint column to toggle unconditional breakpoint
- Right-click for breakpoint options menu (type, condition, hit count)
- Breakpoint editor modal for complex conditions

**Breakpoint State:**
```typescript
interface Breakpoint {
  rowIndex: number;
  enabled: boolean;
  type: 'unconditional' | 'conditional' | 'hitCount';
  condition?: string;       // e.g., "source.value > 2000"
  hitCount?: number;        // pause after N hits
  currentHits?: number;     // tracking current hit count
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

### 3.3 Variable Monitor Enhancements

Extend the existing VariableMonitor component:

| Column | Description |
|--------|-------------|
| Name | Variable A-P |
| Value | Current 16-bit value (dec/hex/bin toggle) |
| Writes | Count of writes this session |
| Reads | Count of reads this session |
| Last Write | Row number that last wrote |
| Sparkline | Mini graph of value over last 100 cycles |
| Status | Warning if never read/written |

---

## Phase 4: Multi-Selection & Row Management

### 4.1 Multi-Selection with Shift+Click

Enable selecting multiple rows for batch operations:

**Selection Behavior:**
- Shift+Click: Select range from last selected to clicked row
- Ctrl/Cmd+Click: Toggle individual row selection
- Selected rows get distinct background color
- **Prevent selected rows from unfolding/expanding**

### 4.2 Multi-Selection Toolbar

Show floating toolbar above multi-selection:

```
┌────────────────────────────────────────────────┐
│  [✂ Cut]  [📋 Copy]  [⬆ Move Up]  [⬇ Move Down]  │
│  [🗑 Clear]  [🎨 Color]  [Cancel]                │
└────────────────────────────────────────────────┘
│  Row 5  │████████████████████████████████████│
│  Row 6  │████████████████████████████████████│
│  Row 7  │████████████████████████████████████│
└─────────────────────────────────────────────────
```

**Operations:**
- **Cut**: Remove selected rows, store in clipboard
- **Copy**: Copy selected rows to clipboard
- **Move Up/Down**: Reorder selected rows within the mapping
- **Clear**: Reset selected rows to empty state
- **Color**: Set background color for visual grouping

### 4.3 Background Color Options

Allow users to set background colors for rows/groups:

- Color picker with preset palette (matching NerdSEQ colors)
- Helps visually organize complex mappings
- Stored in JSON metadata
- Colors: None, Red, Orange, Yellow, Green, Blue, Purple, Gray

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

| Metric | Target |
|--------|--------|
| Simulation Speed | 1Hz to 1kHz (adjustable) |
| UI Update Rate | 60fps (16ms) |
| Memory (History) | Max 10MB for 100 cycles |
| Startup Analysis | < 100ms for 70 rows |

### Data Storage

| Data Type | Storage Location |
|-----------|------------------|
| Breakpoints | .json metadata |
| Row comments | .json metadata |
| Global comment | .json metadata |
| Row colors | .json metadata |
| Warnings | Runtime only (regenerated) |
| Execution history | Runtime only |

---

## Implementation Roadmap

```
Phase 1 (Foundation)           Phase 2 (Simulation)
├── Static Analyzer            ├── Virtual Engine
├── Warning Annotations        ├── Running Light
├── Row Value Display          ├── Transport Controls
└── Global Documentation       └── Speed Slider + BPM
        │                               │
        ▼                               ▼
Phase 3 (Debugging)            Phase 4 (Selection)
├── Breakpoint Column          ├── Shift+Click Selection
├── Breakpoint Types           ├── Selection Toolbar
├── Row Value Monitor          └── Background Colors
└── Variable Monitor Enhancements
        │                               │
        ▼                               ▼
Phase 5 (MIDI)                 Phase 6 (Advanced)
├── Live Monitor Integration   ├── Execution History
├── Virtual MIDI Ports         ├── Dependency Graph
└── Test Injection             └── Performance Profiler
```

### Priority Order

1. **Static Logic Analyzer** - Catches errors before hardware upload
2. **Warning Annotations** - Surfaces analyzer results in UI
3. **Row Value Display** - Hex/decimal/binary like NerdSEQ menu
4. **Global Documentation** - Quick win for community sharing
5. **Virtual Execution Engine** - Foundation for all debugging features
6. **Transport Controls + Speed Slider** - Enables debugging workflow
7. **Running Light** - Visual feedback (no comment expansion)
8. **Breakpoint Column & System** - Step-through debugging
9. **Multi-Selection** - Batch operations
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
