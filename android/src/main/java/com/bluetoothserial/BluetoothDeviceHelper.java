package com.bluetoothserial;

import android.bluetooth.BluetoothDevice;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.util.Set;

public class BluetoothDeviceHelper implements Serializable {

    public static JSArray devicesToJSArray(Set<BluetoothDevice> devices) {
        JSArray devicesAsJson = new JSArray();

        for (BluetoothDevice device : devices) {
            devicesAsJson.put(deviceToJSObject(device));
        }

        return devicesAsJson;
    }

    public static JSObject deviceToJSObject(BluetoothDevice device) {
        JSObject json = new JSObject();
        json.put("name", device.getName());
        json.put("address", device.getAddress());
        json.put("id", device.getAddress());
        if (device.getBluetoothClass() != null) {
            json.put("class", device.getBluetoothClass().getDeviceClass());
        }
        return json;
    }

    public static byte[] toByteArray(String value) {
        if (value == null) {
            return new byte[0];
        }

        return value.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Convert an array of bytes (integers from 0 to 255) into a byte array
     * @throws IllegalArgumentException if an item is not an integer from 0 to 255
     */
    public static byte[] toByteArray(JSONArray values) {
        if (values == null) {
            return new byte[0];
        }

        byte[] result = new byte[values.length()];
        for (int i = 0; i < values.length(); i++) {
            Object item = values.opt(i);
            if (!(item instanceof Number)) {
                throw new IllegalArgumentException("Invalid byte at index " + i + ": " + item);
            }
            double number = ((Number) item).doubleValue();
            if (number < 0 || number > 255 || number != Math.floor(number)) {
                throw new IllegalArgumentException("Invalid byte at index " + i + ": " + item);
            }
            result[i] = (byte) (int) number;
        }
        return result;
    }

}
