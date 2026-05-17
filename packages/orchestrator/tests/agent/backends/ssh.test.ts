import { describe, it, expect, vi } from 'vitest';
import { EventEmitter, PassThrough } from 'node:stream';
import { SshBackend } from '../../../src/agent/backends/ssh.js';

interface FakeChild extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  exitCode: number | null;
  kill: (signal?: NodeJS.Signals | number) => boolean;
  once(event: string, listener: (...args: unknown[]) => void): this;
}

function makeFakeChild(): FakeChild {
  const e = new EventEmitter() as FakeChild;
  e.stdin = new PassThrough();
  e.stdout = new PassThrough();
  e.stderr = new PassThrough();
  e.exitCode = null;
  e.kill = vi.fn().mockReturnValue(true);
  return e;
}

function captureSpawn() {
  const calls: { binary: string; args: string[] }[] = [];
  const child = makeFakeChild();
  const impl = ((binary: string, args: readonly string[] = []) => {
    calls.push({ binary, args: [...args] });
    return child as unknown as ReturnType<typeof import('node:child_process').spawn>;
  }) as unknown as typeof import('node:child_process').spawn;
  return { calls, child, impl };
}

describe('SshBackend — construction validation', () => {
  it('rejects a host with shell metacharacters', () => {
    expect(() => new SshBackend({ host: 'evil;rm -rf', remoteCommand: 'agent' })).toThrowError(
      /invalid host/
    );
  });

  it('rejects a host starting with -', () => {
    expect(
      () => new SshBackend({ host: '-oProxyCommand=evil', remoteCommand: 'agent' })
    ).toThrowError(/invalid host/);
  });

  it('rejects an empty remoteCommand', () => {
    expect(() => new SshBackend({ host: 'gpu.lab', remoteCommand: '' })).toThrowError(
      /remoteCommand/
    );
  });
});

describe('SshBackend — buildSshArgs', () => {
  it('emits target, -- separator, and remote command', () => {
    const b = new SshBackend({ host: 'gpu.lab', remoteCommand: 'harness-agent --jsonl' });
    expect(b.buildSshArgs()).toEqual([
      '-o',
      'BatchMode=yes',
      'gpu.lab',
      '--',
      'harness-agent --jsonl',
    ]);
  });

  it('prepends -i, -p, user@host', () => {
    const b = new SshBackend({
      host: 'gpu.lab',
      user: 'alice',
      port: 2222,
      identityFile: '/keys/id',
      remoteCommand: 'harness-agent',
    });
    expect(b.buildSshArgs()).toEqual([
      '-i',
      '/keys/id',
      '-p',
      '2222',
      '-o',
      'BatchMode=yes',
      'alice@gpu.lab',
      '--',
      'harness-agent',
    ]);
  });

  it('threads sshOptions as -o key=value pairs', () => {
    const b = new SshBackend({
      host: 'gpu.lab',
      remoteCommand: 'agent',
      sshOptions: ['ConnectTimeout=5', 'ServerAliveInterval=30'],
    });
    expect(b.buildSshArgs()).toEqual([
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=5',
      '-o',
      'ServerAliveInterval=30',
      'gpu.lab',
      '--',
      'agent',
    ]);
  });
});

describe('SshBackend — runTurn streams NDJSON events', () => {
  it('parses lines and reports final usage from the last usage event', async () => {
    const { impl, child } = captureSpawn();
    const b = new SshBackend({ host: 'gpu.lab', remoteCommand: 'agent', spawnImpl: impl });
    const session = (await b.startSession({ workspacePath: '/tmp', permissionMode: 'full' }))
      .value!;

    const gen = b.runTurn(session, {
      sessionId: session.sessionId,
      prompt: 'hi',
      isContinuation: false,
    });

    setTimeout(() => {
      child.stdout.write(
        JSON.stringify({ type: 'text', content: 'hello ' }) +
          '\n' +
          JSON.stringify({
            type: 'usage',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          }) +
          '\n'
      );
      child.stdout.end();
      child.exitCode = 0;
      child.emit('close', 0);
    }, 0);

    const events: { type: string }[] = [];
    let result: Awaited<ReturnType<typeof gen.next>>;
    while (!(result = await gen.next()).done) {
      events.push(result.value);
    }
    expect(events.map((e) => e.type)).toEqual(['text', 'usage']);
    expect(result.value.success).toBe(true);
    expect(result.value.usage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
  });

  it('marks the turn unsuccessful when the child exits non-zero', async () => {
    const { impl, child } = captureSpawn();
    const b = new SshBackend({ host: 'gpu.lab', remoteCommand: 'agent', spawnImpl: impl });
    const session = (await b.startSession({ workspacePath: '/tmp', permissionMode: 'full' }))
      .value!;
    const gen = b.runTurn(session, {
      sessionId: session.sessionId,
      prompt: 'hi',
      isContinuation: false,
    });
    setTimeout(() => {
      child.stdout.end();
      child.exitCode = 1;
      child.emit('close', 1);
    }, 0);
    let result: Awaited<ReturnType<typeof gen.next>>;
    while (!(result = await gen.next()).done) {
      // consume
    }
    expect(result.value.success).toBe(false);
    expect(result.value.error).toMatch(/exited with code 1/);
  });

  it('emits an error TurnResult when the agent reports type:error', async () => {
    const { impl, child } = captureSpawn();
    const b = new SshBackend({ host: 'gpu.lab', remoteCommand: 'agent', spawnImpl: impl });
    const session = (await b.startSession({ workspacePath: '/tmp', permissionMode: 'full' }))
      .value!;
    const gen = b.runTurn(session, {
      sessionId: session.sessionId,
      prompt: 'hi',
      isContinuation: false,
    });
    setTimeout(() => {
      child.stdout.write(JSON.stringify({ type: 'error', content: 'remote oom' }) + '\n');
      child.stdout.end();
      child.exitCode = 0;
      child.emit('close', 0);
    }, 0);
    let result: Awaited<ReturnType<typeof gen.next>>;
    while (!(result = await gen.next()).done) {
      // consume
    }
    expect(result.value.success).toBe(false);
    expect(result.value.error).toBe('remote oom');
  });
});

describe('SshBackend — healthCheck', () => {
  it('returns Ok when ssh exits 0', async () => {
    const { impl, child } = captureSpawn();
    const b = new SshBackend({ host: 'gpu.lab', remoteCommand: 'agent', spawnImpl: impl });
    const promise = b.healthCheck();
    setTimeout(() => child.emit('close', 0), 0);
    const result = await promise;
    expect(result.ok).toBe(true);
  });

  it('returns Err with stderr context when ssh exits non-zero', async () => {
    const { impl, child } = captureSpawn();
    const b = new SshBackend({ host: 'gpu.lab', remoteCommand: 'agent', spawnImpl: impl });
    const promise = b.healthCheck();
    setTimeout(() => {
      child.stderr.write('Permission denied\n');
      child.emit('close', 255);
    }, 0);
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.ok || result.error.message).toMatch(/255|Permission denied/);
  });
});
