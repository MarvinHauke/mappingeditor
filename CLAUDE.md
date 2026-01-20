# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NerdSEQ Mapping Editor - A web-based editor for creating and managing NerdSEQ hardware mappings. The editor allows users to configure 70 mapping rows that route signals between sources (CV, MIDI, triggers, etc.) and destinations (CV outputs, MIDI, I2C, etc.) on the NerdSEQ sequencer.

## Development Commands

```bash
cd editor
npm install        # Install dependencies
npm run dev        # Start Vite dev server (http://localhost:5173)
npm run build      # Production build (runs type-check + build-only)
npm run type-check # TypeScript strict mode validation
npm run preview    # Preview production build
```

Test files are in `/tests/` with validation scripts:
```bash
node run-tests.js                    # Validates and regenerates all test files
cd tests && node validate-test-files.js  # Manual test validation
```

## Architecture

### Core Data Flow
```
.MAP/.JSON file → Parsers → MappingDocument → Vue UI → Formatters → Export
```

### Key Modules (`editor/src/modules/`)

- **documentModel.ts**: `MappingDocument` class containing 70 `Row` objects + 16 `Variable` objects (A-P). Each row has source/function/extra triplet and destination/function/extra triplet.

- **dataModel.ts**: Lookup tables for all source types (0-14: CV, Trigger, Track, Automator, Envelope, MIDI, MIDI CC, NRPN, I2C, Variable, Calc, Skip, Global, External, Control) and destination types (0-16: CV, Trigger, Track, Automator, Envelope, MIDI CC, I2C, Audio, SetVar, RandomRange, Global, CV16, Table, MIDI, Dual, Skip, Visu).

- **parsers.ts**: `MappingDocumentParser` handles the 1502-byte binary .MAP format (70-byte header, 1400 bytes for 70 rows × 10 uint16 values each, 32 bytes for 16 variables). All values are Little Endian. `0xFFFF` (65535) represents empty/unused fields.

- **formatters.ts**: Export to JSON, HTML, Markdown, and binary .MAP blob.

### UI Components (`editor/src/components/`)

- **EditorApp.vue**: Main component (~1000 lines) with file I/O, 70-row mapping table, copy/paste/clear functionality, MIDI learn integration.

- **\*SourceExtra.vue / \*DestinationExtra.vue**: Type-specific parameter editors for each source/destination type (NRPN, MIDI CC, Variables, CalcSkip, etc.).

- **useMidi.ts** (composables): Web MIDI API integration with NRPN assembly (CC 99/98/6/38 buffering), learn mode (10s timeout), message history.

### Binary Format Reference

See `/docs/mapping_file_definition.txt` for complete .MAP file format specification including all source/destination type codes and their parameters.

## Important Constants

- **EMPTY_KEY**: `0xFFFF` (65535) - represents unused/empty field values
- **Row count**: 70 mapping rows
- **Variables**: 16 named variables (A-P), each 16-bit unsigned (0-4095)
- **MIDI interfaces**: TRS (channels 0-15), USB Host (16-31), USB Device (32-47), Learn (48)

## Tech Stack

- Vue.js 3.4 with Composition API
- TypeScript 5.3 (strict mode)
- Vite 5.0
- Bootstrap 5.3 (Bootswatch Lux dark theme)
- AJV for JSON schema validation
