import { WebPlugin } from '@capacitor/core';
import type { BluetoothConnectOptions, BluetoothConnectResult, BluetoothReadOptions, BluetoothReadResult, BluetoothReadUntilOptions, BluetoothScanResult, BluetoothSerialPlugin, BluetoothStartNotificationsOptions, BluetoothState, BluetoothStopNotificationsOptions, BluetoothWriteOptions } from './definitions';
/**
 * Web implementation, using the Web Serial API (Chromium desktop, Electron).
 *
 * Bluetooth Classic devices are reached through their RFCOMM (SPP) serial port. The device must be paired by the OS.
 * See `BluetoothSerialPortChooser` to let the host list and select the ports (e.g. in Electron).
 */
export declare class BluetoothSerialWeb extends WebPlugin implements BluetoothSerialPlugin {
    /** Maximal duration of a scan */
    static SCAN_DURATION_MS: number;
    /** Once the ports are listed, wait for other ports to be added, during this delay */
    static SCAN_SETTLE_MS: number;
    static CONNECT_TIMEOUT_MS: number;
    static BAUD_RATE: number;
    /** Opened connections, by device address */
    private readonly connections;
    /** Ports already granted, by device address (can be reopened without a new request) */
    private readonly ports;
    /** Port ids, by device address (from the last scan) */
    private readonly portIds;
    /** Pending connections, by device address */
    private readonly pendingConnects;
    private get serial();
    private get chooser();
    isEnabled(): Promise<BluetoothState>;
    canEnable(): Promise<BluetoothState>;
    enable(): Promise<BluetoothState>;
    disable(): Promise<BluetoothState>;
    startEnabledNotifications(): Promise<void>;
    stopEnabledNotifications(): Promise<void>;
    scan(): Promise<BluetoothScanResult>;
    connect(options: BluetoothConnectOptions): Promise<void>;
    connectInsecure(options: BluetoothConnectOptions): Promise<void>;
    disconnect(options: BluetoothConnectOptions): Promise<void>;
    isConnected(options: BluetoothConnectOptions): Promise<BluetoothConnectResult>;
    read(options: BluetoothReadOptions): Promise<BluetoothReadResult>;
    readUntil(options: BluetoothReadUntilOptions): Promise<BluetoothReadResult>;
    write(options: BluetoothWriteOptions): Promise<void>;
    startNotifications(options: BluetoothStartNotificationsOptions): Promise<void>;
    stopNotifications(options: BluetoothStopNotificationsOptions): Promise<void>;
    private requireSerial;
    private getConnection;
    private doConnect;
    /**
     * Without any chooser: let the user grant a port, using the browser native picker (requires a user gesture).
     * A cancellation is ignored.
     */
    private requestPortWithNativePicker;
    /**
     * Bluetooth serial ports already granted to the page. Their MAC address is not exposed by the browser:
     * the address is based on their order, so it may change after a new grant, or after a page reload.
     */
    private getGrantedDevices;
    /**
     * Request the port of a device, selected by the host chooser (by port id, or by MAC address = port name).
     * Without a chooser, the user selects the port in the browser native picker.
     */
    private requestPort;
    private readLoop;
    private notifyReadValues;
    private toDevice;
}
declare const BluetoothSerial: BluetoothSerialWeb;
export { BluetoothSerial };
