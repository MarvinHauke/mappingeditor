# Refactoring Plan: Centralize Form Element Styling

## Current Problem

Form element styling (inputs, selects) is duplicated across multiple components with inconsistent implementations:

### Current State Analysis

**EditorApp.vue:**

- Uses Bootstrap classes: `form-select`, `pt-1`, `form-control`
- Custom classes: `.select-empty`, `.label-empty`
- Inline padding values in various places

**CalcSkipSourceExtra.vue:**

- Uses Bootstrap `pt-1` on selects
- Custom `.select-empty` class (duplicated)
- Background color: `#34cc99`

**VariableSourceExtra.vue:**

- Custom input styling with `padding: 0.25rem 0.75rem`
- Custom `.input-disabled` class
- Background color: `#34cc99`
- Height: 100%

**MidiCcDestinationExtra.vue:**

- Custom input and select styling
- Duplicate `.input-disabled` class
- Duplicate `.select-empty` class
- Background color: `#34cc99`

**RowActionButtons.vue:**

- Custom button styling
- Background color: `#34cc99`
- Disabled state: grey background, opacity 0.3

### Issues Identified

1. **Code Duplication**: `.select-empty`, `.input-disabled`, color values repeated everywhere
2. **Inconsistent Padding**: Different components use different padding values
3. **Inconsistent Heights**: Some use `height: 100%`, others rely on default
4. **No Single Source of Truth**: Changing colors/spacing requires editing 5+ files
5. **Mixed Approach**: Some use Bootstrap classes, others custom CSS

## Proposed Solution

### Option A: CSS Custom Properties (Recommended)

Create a global CSS file with custom properties for all shared styling values.

**Benefits:**

- Easy to change values in one place
- Works with existing component structure
- Can override per component if needed
- Modern CSS approach

**File Structure:**

```
src/
  assets/
    styles/
      variables.css        # CSS custom properties
      form-elements.css    # Shared form element styles
  main.ts                  # Import global styles
```

**variables.css:**

```css
:root {
  /* Colors */
  --color-primary: #34cc99;
  --color-hover: #f1f700;
  --color-disabled: grey;
  --color-empty: grey;
  --color-dark-bg: #3a3a3f;

  /* Form Elements */
  --form-height: 30px;
  --form-padding-vertical: 0.25rem;
  --form-padding-horizontal: 0.75rem;
  --form-border-radius: 0;

  /* Buttons */
  --button-padding: 0 6px;
  --button-font-size: 10px;

  /* Transitions */
  --transition-standard: 0.2s ease;
}
```

**form-elements.css:**

```css
/* Shared form element base styles */
.mapping-select,
.mapping-input {
  background-color: var(--color-primary);
  height: var(--form-height);
  padding: var(--form-padding-vertical) var(--form-padding-horizontal);
  border: none;
  color: black;
  transition: background-color var(--transition-standard);
}

.mapping-select:disabled,
.mapping-input:disabled {
  background-color: var(--color-disabled);
  opacity: 0.3;
  cursor: not-allowed;
}

.select-empty,
.input-empty {
  background-color: var(--color-empty) !important;
  color: black;
}

.mapping-select:hover:not(:disabled),
.mapping-input:hover:not(:disabled) {
  background-color: var(--color-hover);
}

/* Extra component containers */
.extras-container {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  height: 100%;
}

.extras-first,
.extras-second {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100%;
  background-color: var(--color-primary);
}

.extras-first.disabled,
.extras-second.disabled {
  background-color: var(--color-disabled) !important;
}
```

### Option B: Shared Vue Composable

Create a composable that provides consistent styling through JavaScript.

**Benefits:**

- Type-safe
- Can include logic
- Reactive to theme changes

**Drawbacks:**

- More complex
- Requires refactoring component templates
- Overkill for static values

### Option C: Shared SCSS with Mixins

Use SCSS mixins for reusable styles.

**Benefits:**

- DRY code
- Can parameterize styles
- Familiar to many developers

**Drawbacks:**

- Requires SCSS setup
- Build step complexity
- Less flexible than CSS variables at runtime

## Recommended Approach: Option A + Standardization

### Phase 1: Create Global Styles (Immediate)

1. **Create `src/assets/styles/variables.css`**
   - Define all color values as CSS custom properties
   - Define all spacing/sizing values
   - Define transition timings

2. **Create `src/assets/styles/form-elements.css`**
   - Shared `.mapping-select` class for all select elements
   - Shared `.mapping-input` class for all input elements
   - Shared `.select-empty` class (remove duplicates)
   - Shared `.input-disabled` class (remove duplicates)
   - Shared `.extras-container`, `.extras-first`, `.extras-second` classes

3. **Import in `src/main.ts`**
   ```typescript
   import "./assets/styles/variables.css";
   import "./assets/styles/form-elements.css";
   ```

### Phase 2: Refactor Components (Incremental)

**Priority Order:**

1. **EditorApp.vue** (Main template)
   - Replace inline `form-select pt-1` with `mapping-select`
   - Replace inline `form-control` with `mapping-input`
   - Remove duplicate `.select-empty` CSS
   - Use CSS custom properties for colors

2. **CalcSkipSourceExtra.vue**
   - Add `mapping-select` class to selects
   - Remove duplicate `.select-empty`
   - Remove hardcoded `#34cc99` colors

3. **VariableSourceExtra.vue**
   - Add `mapping-input` class to input
   - Remove duplicate `.input-disabled`
   - Use shared `.extras-container`, `.extras-first`, `.extras-second` classes

4. **MidiCcDestinationExtra.vue**
   - Add `mapping-select` class to selects
   - Add `mapping-input` class to inputs
   - Remove all duplicate classes
   - Use shared container classes

5. **RowActionButtons.vue**
   - Use CSS custom properties for colors
   - Standardize transition timing

### Phase 3: Documentation

Create `STYLING_GUIDE.md`:

- When to use each class
- How to add new form elements
- How to change global colors/spacing
- Component styling conventions

## Implementation Steps

### Step 1: Create Global CSS Files ✅ COMPLETED

- [x] Create `src/assets/styles/` directory
- [x] Create `variables.css` with all custom properties
- [x] Create `form-elements.css` with shared classes
- [x] Import in `index.css`

### Step 2: Test Global Styles ✅ COMPLETED

- [x] Verify CSS custom properties work
- [x] Check no conflicts with existing styles
- [x] Verified in browser

### Step 3: Refactor EditorApp.vue ✅ COMPLETED

- [x] Add shared classes to selects and inputs
- [x] Replace hardcoded colors with CSS variables
- [x] Remove duplicate CSS (~50 lines removed)
- [x] Test all form elements work correctly

### Step 4: Refactor Extra Components ✅ COMPLETED

- [x] CalcSkipSourceExtra.vue (~15 lines removed)
- [x] VariableSourceExtra.vue (~20 lines removed)
- [x] MidiCcDestinationExtra.vue (~25 lines removed)
- [x] Test each component after refactoring

### Step 5: Refactor RowActionButtons.vue ✅ COMPLETED

- [x] Use CSS custom properties
- [x] Standardize transitions
- [x] Test button states

### Step 6: Cleanup ✅ COMPLETED

- [x] Remove all duplicate CSS (~120 lines total removed)
- [x] Verify no visual regressions
- [x] Create documentation (STYLING_GUIDE.md)

## Expected Benefits

1. **Single Source of Truth**: Change colors/spacing in one file
2. **Consistency**: All form elements look and behave the same
3. **Maintainability**: Easier to update and debug
4. **Scalability**: Easy to add new components following patterns
5. **File Size**: Reduced CSS duplication (~200-300 lines removed)

## Risks & Mitigation

**Risk**: Breaking existing functionality during refactoring

- **Mitigation**: Incremental refactoring, test each component individually

**Risk**: CSS specificity conflicts

- **Mitigation**: Use scoped styles where needed, test thoroughly

**Risk**: Browser compatibility with CSS custom properties

- **Mitigation**: Target modern browsers (already using Vue 3)

## Alternative: Quick Fix (If Full Refactor Not Desired)

If a full refactor is too much work now, create a shared `FormStyles.css` with just the duplicate classes and import it in each component:

```css
/* FormStyles.css */
.select-empty {
  background-color: grey !important;
  color: black;
}

.input-disabled {
  background-color: grey !important;
}

.extras-container {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  height: 100%;
}
```

This provides immediate benefits with minimal changes.

## Conclusion

**Recommended**: Implement Phase 1 (global styles) immediately, then refactor components incrementally over time. This provides immediate value (single source for colors) without requiring a large upfront investment.

**Estimated Effort**:

- Phase 1: 30-45 minutes
- Phase 2: 1-2 hours (spread across multiple sessions)
- Phase 3: 15 minutes

**Total**: ~2-3 hours for complete refactoring, or 30 minutes for quick wins.
