import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';

describe('Dialog focus behavior', () => {
  it('traps Tab, closes with Escape, and restores focus to its trigger', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild><Button>Open dialog</Button></DialogTrigger>
        <DialogContent>
          <DialogTitle>Example dialog</DialogTitle>
          <DialogDescription>Example dialog focus test.</DialogDescription>
          <input aria-label="First field" />
          <Button>Save</Button>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    const firstField = screen.getByRole('textbox', { name: 'First field' });
    const saveButton = screen.getByRole('button', { name: 'Save' });
    const closeButton = screen.getByRole('button', { name: 'Close' });

    await waitFor(() => expect(firstField).toHaveFocus());
    await user.tab();
    expect(saveButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab();
    expect(firstField).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
