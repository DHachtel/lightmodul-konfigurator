# Produktrahmen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Produktrahmen configuration level — users place/remove product frames on available cube faces in a locked-grid mode.

**Architecture:** frames stored as `Record<string, boolean>` in ConfigState, available faces computed at runtime, rendered as clickable 3D planes with hover/popover, sidebar shows face counter.

**Tech Stack:** TypeScript, React, Three.js / React Three Fiber

**No test framework** — verification via `tsc --noEmit` and manual browser testing.

---

### Task 1: Extend Types and State

Add `frames` to ConfigState, `produktrahmen` to BOMResult, new actions to ConfigActions.

### Task 2: Available Faces Logic

Pure function `computeAvailableFaces()` that returns all valid face IDs.

### Task 3: BOM Counting

Count placed frames in computeBOM, display in BOMPanel and XLS export.

### Task 4: State Actions

Implement toggleFrame, setAllFrames, cleanupFrames in useConfigStore.

### Task 5: 3D Face Rendering

Render clickable face planes in Preview3D, hover highlight, popover for add/remove.

### Task 6: Sidebar Produktrahmen

New SidebarProduktrahmen component with face counter and bulk actions.

### Task 7: Phantom/Button Suppression

Hide phantoms, X-buttons, and basiselement selector in produktrahmen level.

### Task 8: Integration & Wiring

Wire everything together in ConfiguratorShell.
