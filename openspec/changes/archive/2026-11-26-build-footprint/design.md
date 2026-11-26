# Design: Build Footprint

1. **Vendor chunks are keyed by package path.** `manualChunks` checks module
   ids for `@solar-icons`, `fflate`, and the Svelte runtime packages, returning
   stable chunk names. Everything else stays in the application chunk. No
   dynamic import or route change is required.

2. **daisyUI include list follows source usage.** The `@plugin "daisyui"` block
   gains an `include` array naming only component families that appear in
   `.svelte` markup. Themes stay disabled; the vendored `[data-theme]` token
   file remains the single source of color, radius, and size values, so theme
   switching and pin status tokens are unaffected.

3. **Verification checks generated output.** Static tests assert the Vite chunk
   mapping and that every component family used by markup is present in the
   include list. After a production build, the generated CSS is checked for
   the selectors backing the main component families, and the build emits no
   warnings.

## Risks / Trade-offs

- A future component from an excluded daisyUI family would render without its
  component styles until the include list is updated. The source-usage test
  makes that gap visible in `npm test`.
- Manual chunks add extra HTTP requests but improve cache reuse for unchanged
  vendor code. The static site has no server or import map to configure.
