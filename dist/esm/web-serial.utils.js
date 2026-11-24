/** Standard Serial Port Profile (SPP) service class UUID */
export const SPP_SERVICE_CLASS_ID = '00001101-0000-1000-8000-00805f9b34fb';
const MAC_ADDRESS_REGEXP = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i;
/** Extracts a MAC address from a Windows device instance id (e.g. 'BTHENUM\{...}_LOCALMFG&0000\7&2A1B&0&A00CE2FFCF28_C00000000') */
const WINDOWS_BTHENUM_MAC_REGEXP = /&([0-9A-F]{12})_[0-9A-F]+$/i;
export function isMacAddress(value) {
    return !!value && MAC_ADDRESS_REGEXP.test(value);
}
/**
 * Returns the MAC address of a Bluetooth serial port, when the platform exposes it:
 * - Linux (BlueZ): the port name is the MAC address
 * - Windows: the MAC address is the end of the device instance id (BTHENUM)
 */
export function getPortMacAddress(port) {
    if (isMacAddress(port.portName))
        return port.portName.toUpperCase().replace(/-/g, ':');
    const match = port.deviceInstanceId &&
        WINDOWS_BTHENUM_MAC_REGEXP.exec(port.deviceInstanceId);
    // Skip incoming ports (no remote device, so an empty address)
    if (match && !/^0+$/.test(match[1])) {
        return match[1].toUpperCase().match(/.{2}/g).join(':');
    }
    return undefined;
}
/**
 * Detects Bluetooth serial ports (RFCOMM), to exclude other serial ports (e.g. /dev/ttyS0, USB adapters).
 */
export function isBluetoothSerialPort(port) {
    return !!port && !!getPortMacAddress(port);
}
/**
 * Address of the device: its MAC address when known (stable across sessions), otherwise the port id.
 */
export function getPortAddress(port) {
    return getPortMacAddress(port) || port.portId;
}
/**
 * Text buffer of the received data, with the same semantics as the Android implementation:
 * `readUntil()` returns the data up to the delimiter (included), or an empty string if the delimiter
 * has not been received yet.
 */
export class SerialReadBuffer {
    constructor() {
        this.data = '';
    }
    get length() {
        return this.data.length;
    }
    append(value) {
        if (value)
            this.data += value;
    }
    /** Read all the buffered data */
    read() {
        const value = this.data;
        this.data = '';
        return value;
    }
    /** Read the data until the delimiter (included). Returns an empty string, if the delimiter is not found */
    readUntil(delimiter) {
        if (!delimiter)
            return this.read();
        const index = this.data.indexOf(delimiter);
        if (index === -1)
            return '';
        const end = index + delimiter.length;
        const value = this.data.substring(0, end);
        this.data = this.data.substring(end);
        return value;
    }
    /** Read all the complete messages (each ending with the delimiter) */
    readAllUntil(delimiter) {
        const values = [];
        let value;
        while ((value = this.readUntil(delimiter))) {
            values.push(value);
        }
        return values;
    }
    clear() {
        this.data = '';
    }
}
/**
 * Returns true if the error is a cancelled port request (no port selected): 'NotFoundError' or 'AbortError'
 */
export function isRequestCancelledError(err) {
    return err?.name === 'NotFoundError' || err?.name === 'AbortError';
}
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function withTimeout(promise, timeoutMs, message) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
    ]).finally(() => clearTimeout(timer));
}
//# sourceMappingURL=web-serial.utils.js.map