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

class BluetoothSerialWeb extends core.WebPlugin {
    async isEnabled() {
        // not available on web
        return { enabled: true };
    }
    async enable() {
        throw this.unavailable('enable is not available on web.');
    }
    disable() {
        throw this.unavailable('disable is not available on web.');
    }
    startEnabledNotifications() {
        throw this.unavailable('disable is not available on web.');
    }
    stopEnabledNotifications() {
        throw this.unavailable('disable is not available on web.');
    }
    async scan() {
        throw new Error('Method not implemented.');
    }
    async connect(options) {
        if (!options) {
            return Promise.reject(new OptionsRequiredError());
        }
        throw new Error('Method not implemented.');
    }
    async connectInsecure(options) {
        if (!options) {
            return Promise.reject(new OptionsRequiredError());
        }
        throw new Error('Method not implemented.');
    }
    async disconnect(options) {
        if (!options) {
            return Promise.reject(new OptionsRequiredError());
        }
        throw new Error('Method not implemented.');
    }
    async isConnected(options) {
        if (!options) {
            return Promise.reject(new OptionsRequiredError());
        }
        throw new Error('Method not implemented.');
    }
    async read(options) {
        if (!options) {
            return Promise.reject(new OptionsRequiredError());
        }
        throw new Error('Method not implemented.');
    }
    async readUntil(options) {
        if (!options) {
            return Promise.reject(new OptionsRequiredError());
        }
        throw new Error('Method not implemented.');
    }
    async write(options) {
        if (!options) {
            return Promise.reject(new OptionsRequiredError());
        }
        throw new Error('Method not implemented.');
    }
    async startNotifications(options) {
        if (!options) {
            return Promise.reject(new OptionsRequiredError());
        }
        throw new Error('Method not implemented.');
    }
    async stopNotifications(options) {
        if (!options) {
            return Promise.reject(new OptionsRequiredError());
        }
        throw new Error('Method not implemented.');
    }
}
const BluetoothSerial = new BluetoothSerialWeb();

var web = /*#__PURE__*/Object.freeze({
    __proto__: null,
    BluetoothSerialWeb: BluetoothSerialWeb,
    BluetoothSerial: BluetoothSerial
});

exports.BluetoothSerial = BluetoothSerial$1;
//# sourceMappingURL=plugin.cjs.js.map
