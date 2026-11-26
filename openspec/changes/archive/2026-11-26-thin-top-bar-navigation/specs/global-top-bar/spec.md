# Spec Delta

## REMOVED Requirements

### Requirement: One global top bar is mounted on every route

**Reason**: Navigation and workspace actions are now separate bars with different route scopes.

**Migration**: Use the always-mounted thin navigation bar and the workspace-only action bar defined in `thin-top-bar-navigation`.

### Requirement: The PinSpec wordmark is omitted only in the workspace

**Reason**: The thin navigation bar has no wordmark on any route.

**Migration**: Rely on navigation labels and the existing page surfaces for product context.

### Requirement: The collapsed rail reserves horizontal space on every route

**Reason**: The sidebar rail is removed, so no width reservation is needed.

**Migration**: Remove `.app-shell-content` rail padding and the rail-specific CSS classes.

### Requirement: The sidebar toggle is the leftmost global bar control

**Reason**: There is no collapsible sidebar or toggle.

**Migration**: The leftmost thin-bar control is Home.

### Requirement: The global bar composes route context and shared controls

**Reason**: Route context comes from the thin bar's active state and workspace actions have their own bar.

**Migration**: Use the two bars defined in `thin-top-bar-navigation` and keep `topBarUI` as their transient state owner.

### Requirement: Workspace actions are merged into the global bar

**Reason**: Workspace actions moved to a second bar mounted only on workspace and shared routes.

**Migration**: Mount `WorkspaceTopBar.svelte` from the shell for those routes; keep all action handlers unchanged.
