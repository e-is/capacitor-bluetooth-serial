import { WebPlugin } from '@capacitor/core';
import { BluetoothConnectOptions, BluetoothConnectResult, BluetoothStopNotificationsOptions, BluetoothStartNotificationsOptions, BluetoothReadOptions, BluetoothReadResult, BluetoothReadUntilOptions, BluetoothScanResult, BluetoothSerialPlugin, BluetoothState, BluetoothWriteOptions } from './definitions';
export declare class BluetoothSerialWeb extends WebPlugin implements BluetoothSerialPlugin {
    isEnabled(): Promise<BluetoothState>;
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
}
declare const BluetoothSerial: BluetoothSerialWeb;
export { BluetoothSerial };
