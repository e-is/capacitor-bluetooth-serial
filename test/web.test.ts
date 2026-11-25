import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import type { BluetoothSerialPortInfo } from '../src/definitions';
import { BluetoothSerialWeb } from '../src/web';
import {
  isRequestCancelledError,
  sleep,
  withTimeout,
} from '../src/web-serial.utils';

const MAC = 'A0:0C:E2:FF:CF:28';

function namedError(name: string, message = name): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

/** Fake Web Serial port, using the Node.js Web Streams */
class FakePort {
  readable: ReadableStream<Uint8Array> | null = null;
  writable: WritableStream<Uint8Array> | null = null;
  openCount = 0;
  written: string[] = [];
  writeDelayMs = 0;
  private controller?: ReadableStreamDefaultController<Uint8Array>;

  async open(): Promise<void> {
    this.openCount++;
    await sleep(5);
    this.newReadable();
    this.writable = new WritableStream<Uint8Array>({
      write: async chunk => {
        await sleep(this.writeDelayMs);
        this.written.push(new TextDecoder().decode(chunk));
      },
    });
  }

  async close(): Promise<void> {
    if (this.writable?.locked)
      throw new Error('Cannot close: writable stream is locked');
    this.readable = null;
    this.writable = null;
  }

  getInfo() {
    return { bluetoothServiceClassId: '00001101-0000-1000-8000-00805f9b34fb' };
  }

  /** Simulate data received from the device */
  receive(value: string) {
    this.controller?.enqueue(new TextEncoder().encode(value));
  }

  /** Simulate a recoverable error (e.g. BufferOverrunError): the port gives a new readable stream */
  recoverableError() {
    const controller = this.controller;
    this.newReadable();
    controller?.error(namedError('BufferOverrunError'));
  }

  private newReadable() {
    this.readable = new ReadableStream<Uint8Array>({
      start: controller => (this.controller = controller),
    });
  }
}

/** Fake host (e.g. Electron main process + preload): lists the ports and selects one */
class FakeHost {
  ports: BluetoothSerialPortInfo[] = [
    { portId: 'port-1', portName: MAC, displayName: 'Gwaleen' },
    { portId: 'port-2', portName: 'ttyS0' }, // Not a Bluetooth port
  ];
  portObjects = new Map<string, FakePort>([['port-1', new FakePort()]]);
  requestError?: Error;
  requestCount = 0;
  private listeners: ((ports: BluetoothSerialPortInfo[]) => void)[] = [];
  private pending?: {
    resolve: (port: FakePort) => void;
    reject: (err: Error) => void;
  };
  private preselected?: string | null;

  serial = {
    requestPort: (): Promise<FakePort> => {
      this.requestCount++;
      if (this.requestError) return Promise.reject(this.requestError);
      return new Promise<FakePort>((resolve, reject) => {
        this.pending = { resolve, reject };
        setTimeout(() => {
          if (this.preselected !== undefined) {
            const key = this.preselected;
            this.preselected = undefined;
            this.select(key);
          } else {
            this.listeners.forEach(listener => listener(this.ports));
          }
        }, 10);
      });
    },
    getPorts: async () => Array.from(this.portObjects.values()),
  };

  chooser = {
    onPorts: (callback: (ports: BluetoothSerialPortInfo[]) => void) => {
      this.listeners.push(callback);
      return () =>
        (this.listeners = this.listeners.filter(l => l !== callback));
    },
    select: async (key: string | null) => this.select(key),
  };

  private select(key: string | null): boolean {
    if (!this.pending) {
      this.preselected = key;
      return false;
    }
    const { resolve, reject } = this.pending;
    this.pending = undefined;
    const portInfo = key
      ? this.ports.find(p => p.portId === key || p.portName === key)
      : undefined;
    if (portInfo) resolve(this.portObjects.get(portInfo.portId)!);
    else reject(namedError('NotFoundError', 'No port selected by the user.'));
    return true;
  }
}

describe('BluetoothSerialWeb', () => {
  let host: FakeHost;
  let plugin: BluetoothSerialWeb;
  const port = () => host.portObjects.get('port-1')!;

  beforeEach(() => {
    host = new FakeHost();
    Object.defineProperty(globalThis.navigator, 'serial', {
      value: host.serial,
      configurable: true,
    });
    (globalThis as any).window = { BluetoothSerialPortChooser: host.chooser };
    plugin = new BluetoothSerialWeb();
  });

  afterEach(async () => {
    await plugin.disconnect({ address: '' });
    delete (globalThis as any).window;
  });

  it('scan() should list the Bluetooth ports only, without waiting the whole scan duration', async () => {
    const startTime = Date.now();
    const { devices } = await plugin.scan();
    deepStrictEqual(
      devices.map(d => d.address),
      [MAC],
    );
    ok(
      Date.now() - startTime < BluetoothSerialWeb.SCAN_DURATION_MS,
      'should end once the ports are listed',
    );
  });

  it('scan() should throw an error, when the request fails (other than a cancellation)', async () => {
    host.requestError = namedError(
      'SecurityError',
      'Must be handling a user gesture to show a permission request.',
    );
    await rejects(plugin.scan(), /user gesture/);
  });

  it('connect() should share the same connection, when called twice concurrently', async () => {
    await Promise.all([
      plugin.connect({ address: MAC }),
      plugin.connect({ address: MAC }),
    ]);
    strictEqual(port().openCount, 1);
    strictEqual(host.requestCount, 1);
    strictEqual((await plugin.isConnected({ address: MAC })).connected, true);
  });

  it('write() should queue concurrent writes', async () => {
    await plugin.connect({ address: MAC });
    port().writeDelayMs = 20;
    await Promise.all([
      plugin.write({ address: MAC, value: 'a' }),
      plugin.write({ address: MAC, value: 'b' }),
    ]);
    deepStrictEqual(port().written, ['a', 'b']);
  });

  it('should stay connected after a recoverable read error', async () => {
    await plugin.connect({ address: MAC });
    const values: string[] = [];
    await plugin.addListener('onRead', ({ value }) => values.push(value));
    await plugin.startNotifications({ address: MAC, delimiter: '#' });

    port().recoverableError();
    await sleep(20);
    strictEqual((await plugin.isConnected({ address: MAC })).connected, true);

    port().receive('12#');
    await sleep(20);
    deepStrictEqual(values, ['12#']);
  });

  it('disconnect() should close the port', async () => {
    await plugin.connect({ address: MAC });
    await plugin.disconnect({ address: MAC });
    strictEqual((await plugin.isConnected({ address: MAC })).connected, false);
    strictEqual(port().readable, null);
  });
});

describe('web-serial utils', () => {
  it('withTimeout() should reject after the timeout', async () => {
    await rejects(
      withTimeout(new Promise(() => undefined), 10, 'Too long'),
      /Too long/,
    );
    strictEqual(await withTimeout(Promise.resolve(1), 1000, 'Too long'), 1);
  });

  it('isRequestCancelledError() should detect a cancelled port request', () => {
    strictEqual(isRequestCancelledError(namedError('NotFoundError')), true);
    strictEqual(isRequestCancelledError(namedError('AbortError')), true);
    strictEqual(isRequestCancelledError(namedError('SecurityError')), false);
  });
});
