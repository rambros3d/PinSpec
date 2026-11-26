# Proposal: Build Footprint

## Why

The production build emits one 446 kB JavaScript chunk and 371 kB of CSS.
Vendor code that rarely changes (the Svelte runtime, Solar icons, and the
compression codec) is bundled with application code, so every application edit
invalidates the whole download. daisyUI currently emits component styles for
every component even though the application uses a small set.

## What Changes

- Configure Vite to emit separate chunks for the Svelte runtime, Solar icon
  modules, and `fflate`, leaving application code in its own chunk.
- Restrict daisyUI generation to the component families present in the source,
  keeping themes disabled and the vendored theme-token file unchanged.
- Add build-contract tests for the chunk mapping, the daisyUI include list, and
  the required component selectors in the generated CSS.

## Capabilities

- `build-footprint`

## Out of scope

No UI behavior, routing, data generation, solver, or dependency change. No new
npm package is added, and runtime data URLs continue to use
`import.meta.env.BASE_URL`.
