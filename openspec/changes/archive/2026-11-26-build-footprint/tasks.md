# Tasks

## 1. Vendor chunk mapping

- [x] 1.1 Add `build.rollupOptions.output.manualChunks` to `vite.config.ts` for `@solar-icons`, `fflate`, and Svelte runtime package ids, with stable chunk names and no change to `base`; verify `BASE_PATH="/pinspec/" npm run build` emits the chunks without warnings
- [x] 1.2 Add a static build-contract test asserting the chunk names and package-id checks; verify `npm test` passes

## 2. daisyUI component restriction

- [x] 2.1 Add an `include` list to the daisyUI plugin block in `src/app.css` covering every component family used in `.svelte` markup, keeping `themes: false` and the vendored theme imports untouched; verify the production build emits CSS with the required component selectors
- [x] 2.2 Add a test that compares component-family tokens in markup against the include list and asserts the generated CSS selectors after a build; verify `npm test` passes

## 3. Full verification and closeout

- [x] 3.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm theme tokens, daisyUI classes, share URLs, and STM32 behavior are unchanged and no dependency was added
- [x] 3.2 Run `openspec validate build-footprint --strict`, archive with `openspec archive build-footprint -y`, fix any archived spec purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit code, specs, and archive artifacts
