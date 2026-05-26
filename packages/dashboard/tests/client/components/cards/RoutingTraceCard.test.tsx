import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { RoutingDecision } from '@harness-engineering/types';
import { RoutingTraceCard } from '../../../../src/client/components/cards/RoutingTraceCard';

const ok = (decision: RoutingDecision, type: string): Response =>
  new Response(JSON.stringify({ decision, def: { type } }), { status: 200 });

function mkDecision(): RoutingDecision {
  return {
    timestamp: new Date().toISOString(),
    useCase: { kind: 'skill', skillName: 'X' },
    resolutionPath: [
      { source: 'skill', candidate: 'a', outcome: 'unknown-backend' },
      { source: 'default', candidate: 'b', outcome: 'chosen' },
    ],
    backendName: 'b',
    backendType: 'anthropic',
    durationMs: 3,
  };
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(mkDecision(), 'anthropic'));
});
afterEach(() => {
  vi.restoreAllMocks();
});

function getBodyJson(): Record<string, unknown> {
  const mock = globalThis.fetch as ReturnType<typeof vi.fn>;
  const args = mock.mock.calls[0] ?? [];
  const init = args[1] as RequestInit | undefined;
  return JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
}

describe('RoutingTraceCard', () => {
  it('renders form with skill, mode inputs and submit button', () => {
    render(<RoutingTraceCard />);
    expect(screen.getByTestId('routing-card-trace')).toBeDefined();
    expect(screen.getByRole('textbox', { name: /skill/i }) as HTMLInputElement).toBeDefined();
    expect(screen.getByRole('textbox', { name: /mode/i }) as HTMLInputElement).toBeDefined();
    expect(screen.getByRole('button', { name: /trace/i })).toBeDefined();
  });

  it('POSTs { useCase: { kind: "skill", skillName: "X" } } when only skill is given', async () => {
    render(<RoutingTraceCard />);
    fireEvent.change(screen.getByRole('textbox', { name: /skill/i }), {
      target: { value: 'X' },
    });
    fireEvent.click(screen.getByRole('button', { name: /trace/i }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const body = getBodyJson();
    expect(body).toEqual({ useCase: { kind: 'skill', skillName: 'X' } });
  });

  it('POSTs { useCase: { kind: "skill", skillName: "X", cognitiveMode: "reviewer" } } when both given', async () => {
    render(<RoutingTraceCard />);
    fireEvent.change(screen.getByRole('textbox', { name: /skill/i }), {
      target: { value: 'X' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /mode/i }), {
      target: { value: 'reviewer' },
    });
    fireEvent.click(screen.getByRole('button', { name: /trace/i }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(getBodyJson()).toEqual({
      useCase: { kind: 'skill', skillName: 'X', cognitiveMode: 'reviewer' },
    });
  });

  it('POSTs { useCase: { kind: "mode", cognitiveMode: "reviewer" } } when only mode is given', async () => {
    render(<RoutingTraceCard />);
    fireEvent.change(screen.getByRole('textbox', { name: /mode/i }), {
      target: { value: 'reviewer' },
    });
    fireEvent.click(screen.getByRole('button', { name: /trace/i }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(getBodyJson()).toEqual({ useCase: { kind: 'mode', cognitiveMode: 'reviewer' } });
  });

  it('does NOT fetch and shows inline validation when both fields empty', () => {
    render(<RoutingTraceCard />);
    fireEvent.click(screen.getByRole('button', { name: /trace/i }));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Provide a skill or a mode.')).toBeDefined();
  });

  it('renders trace-backend, trace-backend-type, and trace-resolution-path on success', async () => {
    render(<RoutingTraceCard />);
    fireEvent.change(screen.getByRole('textbox', { name: /skill/i }), {
      target: { value: 'X' },
    });
    fireEvent.click(screen.getByRole('button', { name: /trace/i }));
    await waitFor(() => expect(screen.getByTestId('trace-backend')).toBeDefined());
    expect(screen.getByTestId('trace-backend').textContent).toContain('b');
    expect(screen.getByTestId('trace-backend-type').textContent).toContain('anthropic');
    const ol = screen.getByTestId('trace-resolution-path');
    expect(within(ol).getAllByRole('listitem').length).toBe(2);
  });

  it('renders trace-error on non-2xx response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('boom', { status: 400, statusText: 'Bad Request' })
    );
    render(<RoutingTraceCard />);
    fireEvent.change(screen.getByRole('textbox', { name: /skill/i }), {
      target: { value: 'X' },
    });
    fireEvent.click(screen.getByRole('button', { name: /trace/i }));
    await waitFor(() => expect(screen.getByTestId('trace-error')).toBeDefined());
    expect(screen.getByTestId('trace-error').textContent).toContain('boom');
  });
});
