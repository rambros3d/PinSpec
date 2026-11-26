import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('shared native dialog wrapper', () => {
  const wrapper = read('src/components/shell/Dialog.svelte');

  it('owns the native dialog mechanics once', () => {
    for (const token of [
      'import { onMount } from \'svelte\'',
      'openDialogWithFocus',
      '<dialog',
      'class="modal"',
      'bind:this={dialogEl}',
      'showModal()',
      'dialogEl?.close()',
      'onclose={onClose}',
      'oncancel=',
      'modal-backdrop',
      'aria-label={ariaLabel}',
      '<div class={`modal-box ${boxClass}`}>',
      '{@render children()}',
    ]) {
      expect(wrapper, token).toContain(token);
    }
    expect(wrapper.indexOf('<div class={`modal-box ${boxClass}`}>')).toBeLessThan(
      wrapper.indexOf('<form method="dialog" class="modal-backdrop">'),
    );
    expect(wrapper).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('exposes the caller-facing props and an exported close path', () => {
    for (const token of [
      'ariaLabel: string',
      'boxClass: string',
      'onClose: () => void',
      'focusTarget = $bindable(null)',
      'backdropLabel = \'Close\'',
      'children: Snippet',
      'export function close()',
    ]) {
      expect(wrapper, token).toContain(token);
    }
  });

  it('is the only native dialog implementation used by modal callers', () => {
    const callers = [
      'src/components/workspace/ExportModal.svelte',
      'src/components/workspace/McuSwitcherModal.svelte',
      'src/components/workspace/BoardSelectorModal.svelte',
      'src/components/workspace/CompatibleMcuFinder.svelte',
      'src/components/workspace/PinoutDiffModal.svelte',
      'src/components/workspace/ShortcutHelpDialog.svelte',
      'src/pages/LandingPage.svelte',
    ];
    for (const file of callers) {
      const source = read(file);
      expect(source, file).toMatch(/Dialog\.svelte'/);
      expect(source, file).toContain('<Dialog');
      expect(source, file).not.toContain('showModal()');
      expect(source, file).not.toContain('class="modal-backdrop"');
    }
  });
});
