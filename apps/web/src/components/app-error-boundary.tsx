import React from 'react';
import { Button } from '@/components/ui/button';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/** Keeps a page render failure from replacing the entire app with a blank screen. */
export class AppErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  private goBack = () => {
    this.setState({ hasError: false }, () => window.history.back());
  };

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">This page ran into a problem</h1>
        <p className="max-w-md text-muted-foreground">
          Try reloading the page or returning to the previous screen.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={this.goBack}>Go back</Button>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </main>
    );
  }
}
