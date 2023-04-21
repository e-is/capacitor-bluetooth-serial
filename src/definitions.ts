import {PluginListenerHandle} from "@capacitor/core";

export interface BluetoothSerialPlugin {

  isEnabled(): Promise<BluetoothState>;

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
  addListener(
      eventName: 'onRead',
      listenerFunc: (result: BluetoothReadResult) => void,
  ): PluginListenerHandle;

  /**
   * Listen for bluetooth state changed
   * @since 0.0.5
   */
  addListener(
      eventName: 'onEnabledChanged',
      listenerFunc: (result: BluetoothState) => void,
  ): PluginListenerHandle;

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
    value: string;
}

export interface BluetoothStartNotificationsOptions {
  address: string;
  delimiter: string;
}

export interface BluetoothStopNotificationsOptions {
  address: string;
}
