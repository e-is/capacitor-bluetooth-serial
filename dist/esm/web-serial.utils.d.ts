import type { BluetoothSerialPortInfo } from './definitions';
/** Standard Serial Port Profile (SPP) service class UUID */
export declare const SPP_SERVICE_CLASS_ID = "00001101-0000-1000-8000-00805f9b34fb";
export declare function isMacAddress(value: string | undefined | null): boolean;
/**
 * Returns the MAC address of a Bluetooth serial port, when the platform exposes it:
 * - Linux (BlueZ): the port name is the MAC address
 * - Windows: the MAC address is the end of the device instance id (BTHENUM)
 */
export declare function getPortMacAddress(port: BluetoothSerialPortInfo): string | undefined;
/**
 * Detects Bluetooth serial ports (RFCOMM), to exclude other serial ports (e.g. /dev/ttyS0, USB adapters).
 */
export declare function isBluetoothSerialPort(port: BluetoothSerialPortInfo): boolean;
/**
 * Address of the device: its MAC address when known (stable across sessions), otherwise the port id.
 */
export declare function getPortAddress(port: BluetoothSerialPortInfo): string;
/**
 * Text buffer of the received data, with the same semantics as the Android implementation:
 * `readUntil()` returns the data up to the delimiter (included), or an empty string if the delimiter
 * has not been received yet.
 */
export declare class SerialReadBuffer {
    private data;
    get length(): number;
    append(value: string): void;
    /** Read all the buffered data */
    read(): string;
    /** Read the data until the delimiter (included). Returns an empty string, if the delimiter is not found */
    readUntil(delimiter: string): string;
    /** Read all the complete messages (each ending with the delimiter) */
    readAllUntil(delimiter: string): string[];
    clear(): void;
}
/**
 * Returns true if the error is a cancelled port request (no port selected): 'NotFoundError' or 'AbortError'
 */
export declare function isRequestCancelledError(err: any): boolean;
/**
 * Data to send: a string is UTF-8 encoded, an array must contain bytes (integers from 0 to 255)
 */
export declare function toWriteBytes(value: string | number[]): Uint8Array;
export declare function sleep(ms: number): Promise<void>;
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T>;
