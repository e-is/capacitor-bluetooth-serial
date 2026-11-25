'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var core = require('@capacitor/core');

const BluetoothSerial$1 = core.registerPlugin('BluetoothSerial', {
    web: () => Promise.resolve().then(function () { return web; }).then(m => new m.BluetoothSerialWeb()),
});

class OptionsRequiredError extends Error {
    constructor() {
        super("This method requires an options argument");
    }
}
class NotConnectedError extends Error {
    constructor() {
        super("Not connected to requested peripheral");
    }
}

/** Standard Serial Port Profile (SPP) service class UUID */
const SPP_SERVICE_CLASS_ID = '00001101-0000-1000-8000-00805f9b34fb';
const MAC_ADDRESS_REGEXP = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i;
/** Extracts a MAC address from a Windows device instance id (e.g. 'BTHENUM\{...}_LOCALMFG&0000\7&2A1B&0&A00CE2FFCF28_C00000000') */
const WINDOWS_BTHENUM_MAC_REGEXP = /&([0-9A-F]{12})_[0-9A-F]+$/i;
function isMacAddress(value) {
    return !!value && MAC_ADDRESS_REGEXP.test(value);
}
/**
 * Returns the MAC address of a Bluetooth serial port, when the platform exposes it:
 * - Linux (BlueZ): the port name is the MAC address
 * - Windows: the MAC address is the end of the device instance id (BTHENUM)
 */
function getPortMacAddress(port) {
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
function isBluetoothSerialPort(port) {
    return !!port && !!getPortMacAddress(port);
}
/**
 * Address of the device: its MAC address when known (stable across sessions), otherwise the port id.
 */
function getPortAddress(port) {
    return getPortMacAddress(port) || port.portId;
}
/**
 * Text buffer of the received data, with the same semantics as the Android implementation:
 * `readUntil()` returns the data up to the delimiter (included), or an empty string if the delimiter
 * has not been received yet.
 */
class SerialReadBuffer {
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
function isRequestCancelledError(err) {
    return err?.name === 'NotFoundError' || err?.name === 'AbortError';
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function withTimeout(promise, timeoutMs, message) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
    ]).finally(() => clearTimeout(timer));
}

/**
 * Web implementation, using the Web Serial API (Chromium desktop, Electron).
 *
 * Bluetooth Classic devices are reached through their RFCOMM (SPP) serial port. The device must be paired by the OS.
 * See `BluetoothSerialPortChooser` to let the host list and select the ports (e.g. in Electron).
 */
class BluetoothSerialWeb extends core.WebPlugin {
    constructor() {
        super(...arguments);
        /** Opened connections, by device address */
        this.connections = new Map();
        /** Ports already granted, by device address (can be reopened without a new request) */
        this.ports = new Map();
        /** Port ids, by device address (from the last scan) */
        this.portIds = new Map();
        /** Pending connections, by device address */
        this.pendingConnects = new Map();
    }
    get serial() {
        return typeof navigator !== 'undefined'
            ? navigator.serial
            : undefined;
    }
    get chooser() {
        return typeof window !== 'undefined'
            ? window.BluetoothSerialPortChooser
            : undefined;
    }
    async isEnabled() {
        return { enabled: !!this.serial };
    }
    async canEnable() {
        // Cannot switch the Bluetooth adapter on, from a web page
        return { enabled: false };
    }
    async enable() {
        return this.isEnabled();
    }
    async disable() {
        throw this.unavailable('disable is not available on web.');
    }
    async startEnabledNotifications() {
        // Not available on web
    }
    async stopEnabledNotifications() {
        // Not available on web
    }
    async scan() {
        const serial = this.requireSerial();
        const chooser = this.chooser;
        // No chooser (e.g. in a browser): ask the user to grant a port (native picker), then list the granted ports
        if (!chooser) {
            await this.requestPortWithNativePicker(serial);
            return { devices: await this.getGrantedDevices(serial) };
        }
        let ports;
        let listedAt = 0;
        const stopListening = chooser.onPorts(value => {
            ports = value || [];
            listedAt = listedAt || Date.now();
        });
        let requestError;
        let requestEnded = false;
        try {
            const request = serial
                .requestPort({
                allowedBluetoothServiceClassIds: [SPP_SERVICE_CLASS_ID],
            })
                .then(() => undefined, err => {
                if (!isRequestCancelledError(err))
                    requestError = err;
            })
                .finally(() => (requestEnded = true));
            // Wait the ports to be listed (then a short delay, for other ports to be added)
            const startTime = Date.now();
            while (!requestEnded &&
                Date.now() - startTime < BluetoothSerialWeb.SCAN_DURATION_MS) {
                if (listedAt &&
                    Date.now() - listedAt >= BluetoothSerialWeb.SCAN_SETTLE_MS)
                    break;
                await sleep(50);
            }
            // Release the request (a new one will be done by connect())
            if (!requestEnded)
                await chooser.select(null);
            await request;
        }
        finally {
            stopListening();
        }
        // The request failed (e.g. no user gesture, permission denied)
        if (requestError)
            throw requestError;
        const devices = (ports || []).filter(isBluetoothSerialPort).map(port => {
            const address = getPortAddress(port);
            this.portIds.set(address, port.portId);
            return this.toDevice(port);
        });
        return { devices };
    }
    async connect(options) {
        if (!options?.address)
            throw new OptionsRequiredError();
        const address = options.address;
        if (this.connections.has(address))
            return; // Already connected
        // Already connecting: wait the same connection
        let pending = this.pendingConnects.get(address);
        if (!pending) {
            pending = this.doConnect(address).finally(() => this.pendingConnects.delete(address));
            this.pendingConnects.set(address, pending);
        }
        return pending;
    }
    async connectInsecure(options) {
        return this.connect(options);
    }
    async disconnect(options) {
        if (!options)
            throw new OptionsRequiredError();
        // No address: disconnect all
        const connections = options.address
            ? [this.connections.get(options.address)].filter((c) => !!c)
            : Array.from(this.connections.values());
        for (const connection of connections) {
            connection.closing = true;
            try {
                await connection.reader?.cancel();
            }
            catch (err) {
                // Continue
            }
            await connection.readLoop;
        }
    }
    async isConnected(options) {
        if (!options?.address)
            throw new OptionsRequiredError();
        return { connected: this.connections.has(options.address) };
    }
    async read(options) {
        if (!options?.address)
            throw new OptionsRequiredError();
        return { value: this.getConnection(options.address).buffer.read() };
    }
    async readUntil(options) {
        if (!options?.address)
            throw new OptionsRequiredError();
        return {
            value: this.getConnection(options.address).buffer.readUntil(options.delimiter),
        };
    }
    async write(options) {
        if (!options?.address)
            throw new OptionsRequiredError();
        const connection = this.getConnection(options.address);
        const data = new TextEncoder().encode(options.value);
        // Queue the write, after the pending ones
        const write = connection.writes
            .catch(() => undefined)
            .then(async () => {
            const writable = connection.port.writable;
            if (!writable || connection.closing)
                throw new NotConnectedError();
            const writer = writable.getWriter();
            try {
                await writer.write(data);
            }
            finally {
                writer.releaseLock();
            }
        });
        connection.writes = write;
        return write;
    }
    async startNotifications(options) {
        if (!options?.address)
            throw new OptionsRequiredError();
        const connection = this.getConnection(options.address);
        connection.notificationDelimiter = options.delimiter;
        // Emit data already received
        this.notifyReadValues(connection);
    }
    async stopNotifications(options) {
        if (!options?.address)
            throw new OptionsRequiredError();
        const connection = this.connections.get(options.address);
        if (connection)
            connection.notificationDelimiter = undefined;
    }
    /* -- internal functions -- */
    requireSerial() {
        const serial = this.serial;
        if (!serial)
            throw this.unavailable('Web Serial API not available in this browser.');
        return serial;
    }
    getConnection(address) {
        const connection = this.connections.get(address);
        if (!connection)
            throw new NotConnectedError();
        return connection;
    }
    async doConnect(address) {
        const port = this.ports.get(address) || (await this.requestPort(address));
        await port.open({ baudRate: BluetoothSerialWeb.BAUD_RATE });
        this.ports.set(address, port);
        const connection = {
            address,
            port,
            buffer: new SerialReadBuffer(),
            writes: Promise.resolve(),
        };
        this.connections.set(address, connection);
        connection.readLoop = this.readLoop(connection);
    }
    /**
     * Without any chooser: let the user grant a port, using the browser native picker (requires a user gesture).
     * A cancellation is ignored.
     */
    async requestPortWithNativePicker(serial) {
        try {
            return await serial.requestPort({
                allowedBluetoothServiceClassIds: [SPP_SERVICE_CLASS_ID],
            });
        }
        catch (err) {
            if (isRequestCancelledError(err))
                return undefined;
            throw err;
        }
    }
    /**
     * Bluetooth serial ports already granted to the page. Their MAC address is not exposed by the browser:
     * the address is based on their order, so it may change after a new grant, or after a page reload.
     */
    async getGrantedDevices(serial) {
        const ports = (await serial.getPorts()).filter(port => !!port.getInfo().bluetoothServiceClassId);
        return ports.map((port, index) => {
            const address = `web-serial-${index}`;
            this.ports.set(address, port);
            return this.toDevice({ portId: address, portName: address });
        });
    }
    /**
     * Request the port of a device, selected by the host chooser (by port id, or by MAC address = port name).
     * Without a chooser, the user selects the port in the browser native picker.
     */
    async requestPort(address) {
        const serial = this.requireSerial();
        const chooser = this.chooser;
        if (!chooser) {
            const port = await this.requestPortWithNativePicker(serial);
            if (!port)
                throw new Error(`Device '${address}' not selected`);
            return port;
        }
        // Select in advance: the host will select the port as soon as it is listed
        await chooser.select(this.portIds.get(address) || address);
        try {
            return await withTimeout(serial.requestPort({
                allowedBluetoothServiceClassIds: [SPP_SERVICE_CLASS_ID],
            }), BluetoothSerialWeb.CONNECT_TIMEOUT_MS, `Device '${address}' not found`);
        }
        catch (err) {
            await chooser.select(null); // Cancel the request
            throw err;
        }
    }
    async readLoop(connection) {
        const { port, buffer } = connection;
        const decoder = new TextDecoder();
        // Some read errors are recoverable (e.g. BufferOverrunError, FramingError, BreakError): then the port gives
        // a new readable stream. Other errors (e.g. device lost) make 'port.readable' null, which stops the loop.
        while (port.readable && !connection.closing) {
            const reader = port.readable.getReader();
            connection.reader = reader;
            try {
                for (;;) {
                    const { value, done } = await reader.read();
                    if (done)
                        break;
                    buffer.append(decoder.decode(value, { stream: true }));
                    this.notifyReadValues(connection);
                }
            }
            catch (err) {
                if (!connection.closing) {
                    console.warn(`[bluetooth-serial] Read error on '${connection.address}': ${err?.message || err}`);
                }
            }
            finally {
                reader.releaseLock();
                connection.reader = undefined;
            }
        }
        // Disconnected (or device lost)
        connection.closing = true;
        this.connections.delete(connection.address);
        await connection.writes.catch(() => undefined); // Wait the pending writes (the writable stream must be unlocked)
        try {
            await port.close();
        }
        catch (err) {
            console.warn(`[bluetooth-serial] Cannot close the port of '${connection.address}': ${err?.message || err}`);
            // Forget the port: a new one will be requested, at the next connection
            this.ports.delete(connection.address);
        }
    }
    notifyReadValues(connection) {
        const delimiter = connection.notificationDelimiter;
        if (!delimiter)
            return;
        for (const value of connection.buffer.readAllUntil(delimiter)) {
            this.notifyListeners('onRead', { value });
        }
    }
    toDevice(port) {
        const address = getPortAddress(port);
        return {
            name: port.displayName || port.portName || address,
            id: address,
            address,
            class: 0,
            uuid: SPP_SERVICE_CLASS_ID,
            rssi: 0,
        };
    }
}
/** Maximal duration of a scan */
BluetoothSerialWeb.SCAN_DURATION_MS = 4000;
/** Once the ports are listed, wait for other ports to be added, during this delay */
BluetoothSerialWeb.SCAN_SETTLE_MS = 500;
BluetoothSerialWeb.CONNECT_TIMEOUT_MS = 10000;
BluetoothSerialWeb.BAUD_RATE = 9600;
const BluetoothSerial = new BluetoothSerialWeb();

var web = /*#__PURE__*/Object.freeze({
    __proto__: null,
    BluetoothSerialWeb: BluetoothSerialWeb,
    BluetoothSerial: BluetoothSerial
});

exports.BluetoothSerial = BluetoothSerial$1;
//# sourceMappingURL=plugin.cjs.js.map
