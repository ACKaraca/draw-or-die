import { fireEvent, render, screen } from '@testing-library/react';

import { ConfirmDialog } from '@/components/ConfirmDialog';

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const props = {
    isOpen: true,
    title: 'Delete this analysis?',
    description: 'It will be removed after 30 days.',
    confirmLabel: 'Delete permanently',
    cancelLabel: 'Cancel',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
  render(<ConfirmDialog {...props} />);
  return props;
}

describe('ConfirmDialog', () => {
  it('renders an accessible modal dialog labelled by its title', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Delete this analysis?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('It will be removed after 30 days.');
  });

  it('moves focus into the dialog, onto cancel for destructive actions', () => {
    renderDialog({ isDestructive: true });

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('focuses the confirm action for non-destructive prompts', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Delete permanently' })).toHaveFocus();
  });

  it('closes with Escape and keeps Tab focus inside the dialog', () => {
    const props = renderDialog({ isDestructive: true });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete permanently' });

    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirms and blocks dismissal while busy', () => {
    const props = renderDialog({ isBusy: true, busyLabel: 'Deleting…' });

    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
