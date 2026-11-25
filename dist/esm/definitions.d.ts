import type { PluginListenerHandle } from '@capacitor/core';
export interface BluetoothSerialPlugin {
    isEnabled(): Promise<BluetoothState>;
    /**
     * Checks whether Bluetooth can be enabled on the device.
     *
     * @return {Promise<BluetoothState>} A promise that resolves to the current state of Bluetooth, indicating if it can be enabled.
     */
    canEnable(): Promise<BluetoothState>;
    /**
     * Enables the Bluetooth functionality on the device.
     *
     * @return {Promise<BluetoothState>} A promise that resolves to the current state of Bluetooth after enabling it, encapsulated as a `BluetoothState` object.
     */
    enable(): Promise<BluetoothState>;
    /**
     * Disable bluetooth (turn bluetooth off)
     * @since 0.0.5
     */
    disable(): Promise<BluetoothState>;
    /**
     * Start to listen bluetooth state changes (will emit a 'onEnabledChanged' event when state changed)
     * @since 0.0.5
     */
    startEnabledNotifications(): Promise<void>;
    /**
     * Stop to listen bluetooth state changes
     * @since 0.0.5
     */
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
    /**
     * Listen for device input value
     * @since 0.0.5
     */
    addListener(eventName: 'onRead', listenerFunc: (result: BluetoothReadResult) => void): Promise<PluginListenerHandle>;
    /**
     * Listen for bluetooth state changed
     * @since 0.0.5
     */
    addListener(eventName: 'onEnabledChanged', listenerFunc: (result: BluetoothState) => void): Promise<PluginListenerHandle>;
    /**
     *
     * @since 0.0.5
     */
    removeAllListeners(): Promise<void>;
}
export interface BluetoothState {
    enabled: boolean;
}
export interface BluetoothScanResult {
    devices: BluetoothDevice[];
}
export interface BluetoothConnectResult {
    connected: boolean;
}
export interface BluetoothReadResult {
    value: string;
}
export interface BluetoothDevice {
    name: string;
    id: string;
    address: string;
    class: number;
    uuid: string;
    rssi: number;
}
export interface BluetoothConnectOptions {
    address: string;
}
export interface BluetoothReadOptions {
    address: string;
}
export interface BluetoothReadUntilOptions {
    address: string;
    delimiter: string;
}
export interface BluetoothWriteOptions {
    address: string;
    /**
     * Data to send: a string (UTF-8 encoded), or an array of bytes (integers from 0 to 255)
     * @since 6.2.0 (array of bytes)
     */
    value: string | number[];
}
export interface BluetoothStartNotificationsOptions {
    address: string;
    delimiter: string;
}
export interface BluetoothStopNotificationsOptions {
    address: string;
}
/**
 * Serial port, as listed by the host (e.g. Electron 'select-serial-port' event)
 * @since 6.1.0
 */
export interface BluetoothSerialPortInfo {
    portId: string;
    portName: string;
    displayName?: string;
    vendorId?: string;
    productId?: string;
    serialNumber?: string;
    deviceInstanceId?: string;
    usbDriverName?: string;
}
/**
 * Web implementation only: lets the host (e.g. an Electron app) list the serial ports and select one,
 * while `navigator.serial.requestPort()` is pending.
 *
 * Must be exposed as `window.BluetoothSerialPortChooser` (e.g. by an Electron preload script, that relays
 * the 'select-serial-port' session event). Without it, the web implementation can only use the ports
 * already granted (`navigator.serial.getPorts()`).
 * @since 6.1.0
 */
export interface BluetoothSerialPortChooser {
    /**
     * Listen the ports offered by the host, while a port request is pending.
     * @return a function to stop listening
     */
    onPorts(callback: (ports: BluetoothSerialPortInfo[]) => void): () => void;
    /**
     * Select a port (by its `portId` or its `portName`), or cancel the pending request (null).
     * If no request is pending yet, the port should be selected as soon as it is listed by the next request.
     */
    select(portIdOrName: string | null): Promise<boolean>;
}
