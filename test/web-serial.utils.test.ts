import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { describe, it } from 'node:test';

import {
  getPortAddress,
  isBluetoothSerialPort,
  SerialReadBuffer,
  toWriteBytes,
} from '../src/web-serial.utils';

describe('SerialReadBuffer', () => {
  it('readUntil() should return the data up to the delimiter (included)', () => {
    const buffer = new SerialReadBuffer();
    buffer.append('abc#def');
    strictEqual(buffer.readUntil('#'), 'abc#');
    strictEqual(buffer.read(), 'def');
  });

  it('readUntil() should return an empty string when the delimiter is not received yet', () => {
    const buffer = new SerialReadBuffer();
    buffer.append('ab');
    strictEqual(buffer.readUntil('#'), '');
    buffer.append('c#');
    strictEqual(buffer.readUntil('#'), 'abc#');
    strictEqual(buffer.length, 0);
  });

  it('readAllUntil() should split fragmented messages', () => {
    const buffer = new SerialReadBuffer();
    const values: string[] = [];
    for (const chunk of ['%t,1', '23#%t,', '45#%t,6', '7']) {
      buffer.append(chunk);
      values.push(...buffer.readAllUntil('#'));
    }
    deepStrictEqual(values, ['%t,123#', '%t,45#']);
    strictEqual(buffer.read(), '%t,67');
  });

  it('should support multi-character delimiters', () => {
    const buffer = new SerialReadBuffer();
    buffer.append('a\r\nb\r\n');
    deepStrictEqual(buffer.readAllUntil('\r\n'), ['a\r\n', 'b\r\n']);
  });
});

describe('Bluetooth serial ports', () => {
  it('should detect a Linux RFCOMM port (port name = MAC address)', () => {
    const port = {
      portId: '53C1E1E18D4E2426CF438A0CB5BB3872',
      portName: 'A0:0C:E2:FF:CF:28',
      displayName: 'OpenSwim Pro by Shokz',
    };
    strictEqual(isBluetoothSerialPort(port), true);
    strictEqual(getPortAddress(port), 'A0:0C:E2:FF:CF:28');
  });

  it('should detect a Windows Bluetooth COM port (BTHENUM)', () => {
    const port = {
      portId: 'X',
      portName: 'COM5',
      deviceInstanceId:
        'BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_LOCALMFG&0002\\7&3A1B4C5D&0&A00CE2FFCF28_C00000000',
    };
    strictEqual(isBluetoothSerialPort(port), true);
    strictEqual(getPortAddress(port), 'A0:0C:E2:FF:CF:28');
  });

  it('should exclude incoming Windows ports, and other serial ports', () => {
    strictEqual(
      isBluetoothSerialPort({
        portId: 'X',
        portName: 'COM6',
        deviceInstanceId:
          'BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_LOCALMFG&0000\\7&3A1B4C5D&0&000000000000_00000000',
      }),
      false,
    );
    strictEqual(
      isBluetoothSerialPort({ portId: 'X', portName: 'ttyS0' }),
      false,
    );
    strictEqual(
      isBluetoothSerialPort({
        portId: 'X',
        portName: 'ttyUSB0',
        vendorId: '1a86',
      }),
      false,
    );
    strictEqual(getPortAddress({ portId: 'X', portName: 'ttyS0' }), 'X');
  });
});

describe('toWriteBytes', () => {
  it('should encode a string as UTF-8', () => {
    deepStrictEqual(Array.from(toWriteBytes('é#')), [0xc3, 0xa9, 0x23]);
  });

  it('should accept an array of bytes', () => {
    deepStrictEqual(Array.from(toWriteBytes([0, 0x10, 255])), [0, 0x10, 255]);
  });

  it('should reject invalid bytes', () => {
    for (const value of [[-1], [256], [1.5], ['a'], [NaN]]) {
      throws(() => toWriteBytes(value as any), /Invalid byte at index 0/);
    }
    throws(() => toWriteBytes({} as any), /Invalid value/);
  });
});
