# Design: Top Bar Refinements

1. **Height and offsets.** The global navigation bar becomes `h-8` (32 px).
   `.landing-shell` and `.shell-route` use `scroll-padding-top: 2rem`, and the
   Clear All confirmation moves from `top-[5.25rem]` to `top-20` (5 rem) below
   the `h-8` plus `h-12` bars. The workspace action bar stays `h-12`.

2. **Centered, conditional Workspace control.** The thin bar uses three
   regions: left sections, an absolutely centered Workspace control, and right
   resources. On workspace and shared routes the center region is not rendered;
   left and right groups then spread to the edges. On other routes the control
   keeps its existing enabled/disabled derivation and accessible name.

3. **Icon-only secondary controls.** GitHub and keyboard shortcuts drop their
   text spans and use `btn-square` at every width. About keeps its label on
   `sm` and above because it is a primary destination.

4. **Product identity placement.** Non-workspace routes show the Radiokit mark
   and `PinSpec` text as the first element of the left group. Workspace and
   shared routes keep the mark in the existing workspace action bar and do not
   repeat the name in the thin bar. No route-title text is introduced.

5. **Tests follow the contract.** Static shell assertions are updated for the
   new height, offsets, centered and conditional Workspace control, icon-only
   resources, and route-specific wordmark placement.

## Risks / Trade-offs

- The centered control is absolutely positioned; the left and right groups
   keep `min-w-0` and icon-only collapse below `sm` so narrow viewports do not
   overlap the center region.
- Hiding Workspace on its own route removes the active-state highlight there;
   the second bar's project name and chip switcher provide that context.
