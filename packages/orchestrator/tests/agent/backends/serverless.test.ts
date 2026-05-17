import { describe, it, expect, vi } from 'vitest';
import { EventEmitter, PassThrough } from 'node:stream';
import { OciServerlessBackend } from '../../../src/agent/backends/serverless.js';

interface FakeChild extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  exitCode: number | null;
  kill: (signal?: NodeJS.Signals | number) => boolean;
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

function makeSpawnImpl(handlers: Array<(child: FakeChild, args: string[]) => void>) {
  const calls: { binary: string; args: string[] }[] = [];
  let idx = 0;
  const impl = ((binary: string, args: readonly string[] = []) => {
    calls.push({ binary, args: [...args] });
    const child = makeFakeChild();
    const handler = handlers[idx++] ?? (() => undefined);
    setTimeout(() => handler(child, [...args]), 0);
    return child as unknown as ReturnType<typeof import('node:child_process').spawn>;
  }) as unknown as typeof import('node:child_process').spawn;
  return { calls, impl };
}

describe('OciServerlessBackend — construction validation', () => {
  it('rejects an image with shell metacharacters', () => {
    expect(() => new OciServerlessBackend({ image: 'foo;rm' })).toThrowError(/invalid image/);
  });

  it('rejects an image starting with -', () => {
    expect(() => new OciServerlessBackend({ image: '-it' })).toThrowError(/invalid image/);
  });

  it('drops blocked docker flags from extraArgs', () => {
    const b = new OciServerlessBackend({
      image: 'agent:1',
      extraArgs: ['--privileged', '--cap-add=NET_RAW', '--workdir=/work'],
    });
    expect(b.buildRunArgs()).toEqual(['run', '-d', '--rm', '--workdir=/work', '--', 'agent:1']);
  });
});

describe('OciServerlessBackend — buildRunArgs / buildExecArgs', () => {
  it('formats docker run with envPassthrough', () => {
    const b = new OciServerlessBackend({
      image: 'agent:1',
      envPassthrough: ['FOO', 'BAR'],
      envSource: { FOO: '1', BAZ: 'ignored' },
    });
    expect(b.buildRunArgs()).toEqual(['run', '-d', '--rm', '-e', 'FOO=1', '--', 'agent:1']);
  });

  it('builds an exec command for a handle id', () => {
    const b = new OciServerlessBackend({ image: 'agent:1' });
    expect(b.buildExecArgs('abc123')).toEqual(['exec', '-i', 'abc123', '/agent']);
  });
});

describe('OciServerlessBackend — coldStart returns container handle', () => {
  it('parses container id from docker run stdout', async () => {
    const { impl, calls } = makeSpawnImpl([
      (child) => {
        child.stdout.write('deadbeef123\n');
        child.exitCode = 0;
        child.emit('close', 0);
      },
    ]);
    const b = new OciServerlessBackend({ image: 'agent:1', spawnImpl: impl });
    const start = await b.startSession({ workspacePath: '/tmp', permissionMode: 'full' });
    expect(start.ok).toBe(true);
    expect(calls[0]?.binary).toBe('docker');
    expect(calls[0]?.args[0]).toBe('run');
  });

  it('returns Err when docker run exits non-zero', async () => {
    const { impl } = makeSpawnImpl([
      (child) => {
        child.stderr.write('image not found\n');
        child.exitCode = 1;
        child.emit('close', 1);
      },
    ]);
    const b = new OciServerlessBackend({ image: 'agent:1', spawnImpl: impl });
    const start = await b.startSession({ workspacePath: '/tmp', permissionMode: 'full' });
    expect(start.ok).toBe(false);
  });
});

describe('OciServerlessBackend — pullPolicy controls pre-pull', () => {
  it("pullPolicy: 'never' does not invoke docker pull", async () => {
    const { impl, calls } = makeSpawnImpl([
      (child) => {
        child.stdout.write('abc\n');
        child.exitCode = 0;
        child.emit('close', 0);
      },
    ]);
    const b = new OciServerlessBackend({
      image: 'agent:1',
      pullPolicy: 'never',
      spawnImpl: impl,
    });
    await b.startSession({ workspacePath: '/tmp', permissionMode: 'full' });
    expect(calls.find((c) => c.args[0] === 'pull')).toBeUndefined();
  });

  it("pullPolicy: 'always' invokes docker pull before run", async () => {
    const { impl, calls } = makeSpawnImpl([
      (child) => {
        child.exitCode = 0;
        child.emit('close', 0);
      },
      (child) => {
        child.stdout.write('xyz\n');
        child.exitCode = 0;
        child.emit('close', 0);
      },
    ]);
    const b = new OciServerlessBackend({
      image: 'agent:1',
      pullPolicy: 'always',
      spawnImpl: impl,
    });
    const start = await b.startSession({ workspacePath: '/tmp', permissionMode: 'full' });
    expect(start.ok).toBe(true);
    expect(calls[0]?.args[0]).toBe('pull');
    expect(calls[1]?.args[0]).toBe('run');
  });
});
