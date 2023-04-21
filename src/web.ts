import {WebPlugin} from '@capacitor/core';
import {
  BluetoothConnectOptions,
  BluetoothConnectResult,
  BluetoothStopNotificationsOptions,
  BluetoothStartNotificationsOptions,
  BluetoothReadOptions,
  BluetoothReadResult,
  BluetoothReadUntilOptions,
  BluetoothScanResult,
  BluetoothSerialPlugin,
  BluetoothState,
  BluetoothWriteOptions
} from './definitions';
import {OptionsRequiredError} from './utils/errors';

export class BluetoothSerialWeb extends WebPlugin implements BluetoothSerialPlugin {

  async isEnabled(): Promise<BluetoothState> {
    // not available on web
    return {enabled: true};
  }

  async enable(): Promise<BluetoothState> {
    throw this.unavailable('enable is not available on web.');
  }

  disable(): Promise<BluetoothState> {
    throw this.unavailable('disable is not available on web.');
  }

  startEnabledNotifications(): Promise<void> {
    throw this.unavailable('disable is not available on web.');
  }

  stopEnabledNotifications(): Promise<void> {
    throw this.unavailable('disable is not available on web.');
  }

  async scan(): Promise<BluetoothScanResult> {
    throw new Error('Method not implemented.');
  }

  async connect(options: BluetoothConnectOptions): Promise<void> {
    if (!options) {
      return Promise.reject(new OptionsRequiredError());
    }
    throw new Error('Method not implemented.');
  }

  async connectInsecure(options: BluetoothConnectOptions): Promise<void> {
    if (!options) {
      return Promise.reject(new OptionsRequiredError());
    }
    throw new Error('Method not implemented.');
  }

  async disconnect(options: BluetoothConnectOptions): Promise<void> {
    if (!options) {
      return Promise.reject(new OptionsRequiredError());
    }
    throw new Error('Method not implemented.');
  }

  async isConnected(options: BluetoothConnectOptions): Promise<BluetoothConnectResult> {
    if (!options) {
      return Promise.reject(new OptionsRequiredError());
    }
    throw new Error('Method not implemented.');
  }

  async read(options: BluetoothReadOptions):
      Promise<BluetoothReadResult> {
    if (!options) {
      return Promise.reject(new OptionsRequiredError());
    }
    throw new Error('Method not implemented.');
  }

  async readUntil(options: BluetoothReadUntilOptions): Promise<BluetoothReadResult> {
    if (!options) {
      return Promise.reject(new OptionsRequiredError());
    }
    throw new Error('Method not implemented.');
  }

  async write(options: BluetoothWriteOptions): Promise<void> {
    if (!options) {
      return Promise.reject(new OptionsRequiredError());
    }
    throw new Error('Method not implemented.');
  }

  async startNotifications(options: BluetoothStartNotificationsOptions): Promise<void> {
    if (!options) {
      return Promise.reject(new OptionsRequiredError());
    }
    throw new Error('Method not implemented.');
  }

  async stopNotifications(options: BluetoothStopNotificationsOptions): Promise<void> {
    if (!options) {
      return Promise.reject(new OptionsRequiredError());
    }
    throw new Error('Method not implemented.');
  }
}

const BluetoothSerial = new BluetoothSerialWeb();

export { BluetoothSerial };
