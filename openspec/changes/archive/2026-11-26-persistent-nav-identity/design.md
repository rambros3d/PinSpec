# Design: Persistent Navigation Identity

1. **Identity is global.** The centered region of `GlobalNavBar.svelte` always
   renders the Radiokit mark and `PinSpec` name. Only the Workspace control
   remains conditional on non-workspace routes.

2. **Secondary bar unchanged.** `WorkspaceTopBar.svelte` keeps its app icon,
   project name, MCU switcher, and actions. The same mark may appear in both
   bars on workspace routes because the top bar identifies the product and the
   secondary bar identifies the active project context.

3. **Verification.** Static tests assert the identity source has no workspace
   condition, remains centered, and the Workspace control is still hidden on
   workspace routes.

## Risks / Trade-offs

- The repeated mark on workspace routes is intentional: one belongs to global
  navigation, one to the project action row. No new asset or component is added.
