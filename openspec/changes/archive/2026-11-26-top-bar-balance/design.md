# Design: Top Bar Balance

1. **Three regions stay, roles swap.** The thin `h-8` bar keeps left sections,
   a centered region, and right resources. The centered region now holds the
   Radiokit mark and `PinSpec` name on non-workspace routes. The Workspace
   control moves into the right group ahead of About, matching the other action
   controls. Both the centered identity and the Workspace control are absent on
   workspace and shared routes.

2. **Accessibility is unchanged.** The Workspace control keeps its title,
   aria label, disabled state, and enabled/disabled derivation. The identity
   remains non-interactive with a decorative image and a visible name on `sm`
   and above.

3. **Verification is static and behavioral.** Shell tests check the region
   order, the conditional presence of both elements, and the unchanged height;
   no new runtime behavior is introduced.

## Risks / Trade-offs

- The centered identity is absolutely positioned, so the left and right groups
   keep `min-w-0` and icon-only collapse below `sm` to avoid overlap.
