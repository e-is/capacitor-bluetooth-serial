package com.bluetoothserial;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import android.util.Log;

import com.bluetoothserial.plugin.BluetoothSerialPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

public class BluetoothSerialService {
    private static final UUID DEFAULT_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String TAG = "BluetoothSerialService";

    private BluetoothAdapter adapter;
    private BluetoothSerialPlugin plugin;
    private Map<String, BluetoothConnection> connections = new HashMap<>();

    public BluetoothSerialService(BluetoothSerialPlugin plugin, BluetoothAdapter adapter) {
        this.plugin = plugin;
        this.adapter = adapter;
    }

    public void connect(BluetoothDevice device, BluetoothSerialPlugin serial) {
        connect(device, true, serial);
    }

    // TODO
    public void connectInsecure(BluetoothDevice device, BluetoothSerialPlugin serial) {
        connect(device, false, serial);
    }

    private void connect(BluetoothDevice device, boolean secure, BluetoothSerialPlugin serial) {
        BluetoothConnection connection = new BluetoothConnection(device, secure, serial);
        connection.start();

        connections.put(device.getAddress(), connection);
    }

    public boolean disconnectAllDevices() {
        boolean success = true;
        for(String address : connections.keySet()) {
            success = success & disconnect(address);
        }

        return success;
    }

    public boolean disconnect(BluetoothDevice device) {
        String address = device.getAddress();
        return disconnect(address);
    }

    public boolean disconnect(String address) {
        Log.d(TAG, "BEGIN disconnect device " + address);

        BluetoothConnection socket = getConnection(address);

        if(socket == null) {
            Log.e(TAG, "No connection found");
            return true;
        }

        if(!socket.isConnected()) {
            Log.i(TAG, "Device is already disconnected");
        } else {
            return socket.disconnect();
        }

        BluetoothConnection connection = connections.get(address);
        if(connection != null) {
            connection.interrupt();
        }

        connections.remove(address);
        Log.d(TAG, "END disconnect device " + address);

        return true;
    }

    public boolean isConnected(String address) {
        Log.d(TAG, "BEGIN isConnected device " + address);

        BluetoothConnection socket = getConnection(address);

        if(socket == null) {
            Log.e(TAG, "No connection found");
            return false;
        }

        return socket.isConnected();
    }

    /**
     * Write to the connected Device via socket.
     *
     * @param address The device address to send
     * @param out  The bytes to write
     */
    public boolean write(String address, byte[] out) {

        BluetoothConnection r;
        // Synchronize a copy of the ConnectedThread
        synchronized (this) {
            r = getConnection(address);
        }

        if(r == null || !r.isConnected()) {
            return false;
        }

        // Perform the write unsynchronized
        r.write(out);

        return true;
    }

    public String read(String address) throws IOException {
        BluetoothConnection connection = getConnection(address);

        // TODO - criar exception customizada
        if(connection == null) {
            Log.e(TAG, "No connection found");
            throw new IOException("No connection found");
        }

        if(!connection.isConnected()) {
            Log.e(TAG, "Not connected");

            throw new IOException("Not connected");
        }

        return connection.read();
    }

    public String readUntil(String address, String delimiter) throws IOException {
        BluetoothConnection connection = getConnection(address);

        if(connection == null) {
            Log.e(TAG, "No connection found");
            throw new IOException("No connection found");
        }

        if(!connection.isConnected()) {
            Log.e(TAG, "Not connected");

            throw new IOException("Not connected");
        }

        return connection.readUntil(delimiter);
    }

    public void startNotifications(String address, String delimiter, Consumer<String> callback) throws IOException {
        BluetoothConnection connection = getConnection(address);

        if (connection == null) {
            Log.e(TAG, "No connection found");
            throw new IOException("No connection found");
        }

        if (!connection.isConnected()) {
            Log.e(TAG, "Not connected");
            throw new IOException("Not connected");
        }

        connection.startNotifications(delimiter, callback);
    }

    public void stopNotifications(String address) throws IOException {
        BluetoothConnection connection = getConnection(address);

        if(connection == null) {
            Log.e(TAG, "No connection found");
            throw new IOException("No connection found");
        }

        if(!connection.isConnected()) {
            Log.e(TAG, "Not connected");

            throw new IOException("Not connected");
        }

        connection.stopNotifications();
    }

    private BluetoothConnection getConnection(String address) {
        return connections.get(address);
    }

    public void stopAll() {
        disconnectAllDevices();
    }

    public void stop(String address) {
        disconnect(address);
    }

    public void reconnectAll() {
        List<String> addresses = new ArrayList<>(connections.keySet());

        for(String address : addresses) {
            reconnect(address);
        }
    }

    //TODO - nao esta funcionando corretamente
    public void reconnect(String address) {
        BluetoothConnection oldConnection = connections.get(address);
        BluetoothConnection newConnection = new BluetoothConnection(oldConnection);
        disconnect(address);
        newConnection.start();
        connections.put(address, newConnection);
    }

    private enum ConnectionStatus {
        NOT_CONNECTED,
        CONNECTING,
        CONNECTED;
    }

    private class BluetoothConnection extends Thread {
        private final BluetoothDevice device;
        private final boolean secure;
        private final BluetoothSerialPlugin plugin;

        private BluetoothSocket socket = null;
        private InputStream socketInputStream;
        private OutputStream socketOutputStream;

        private boolean enabledNotifications;
        private String notificationDelimiter;
        private StringBuffer readBuffer;
        private Consumer<String> notificationCallback;
        private ConnectionStatus status;

        public BluetoothConnection(BluetoothDevice device, boolean secure, BluetoothSerialPlugin plugin) {
            this.device = device;
            this.secure = secure;
            this.plugin = plugin;
            this.status = ConnectionStatus.NOT_CONNECTED;
            adapter.cancelDiscovery();

            createRfcomm(device, secure);

            socketInputStream = getInputStream(socket);
            socketOutputStream = getOutputStream(socket);
            readBuffer = new StringBuffer();
            this.enabledNotifications = false;
        }

        public BluetoothConnection(BluetoothConnection connection) {
            this(connection.device, connection.secure, connection.plugin);
            this.enabledNotifications = connection.enabledNotifications;
        }

        private void createRfcomm(BluetoothDevice device, boolean secure) {
            String socketType = secure ? "Secure" : "Insecure";
            Log.d(TAG, "BEGIN create socket SocketType:" + socketType);
            status = ConnectionStatus.CONNECTING;
            try {
                if(secure) {
                    socket = device.createRfcommSocketToServiceRecord(DEFAULT_UUID);
                } else {
                    socket = device.createInsecureRfcommSocketToServiceRecord(DEFAULT_UUID);
                }

                Log.d(TAG, "END create socket SocketType:" + socketType);
                Log.d(TAG, "BEGIN connect SocketType:" + socketType);

                socket.connect();

                Log.i(TAG, "Connection success - SocketType:" + socketType);

                Log.d(TAG, "END connect SocketType:" + socketType);

                connected();
            } catch (IOException e) {
                Log.e(TAG, "Socket Type: " + socketType + "create() failed", e);
                connectionFailed();
            }
        }

        public void run() {
            Log.i(TAG, "BEGIN connectedThread");
            byte[] bytesBuffer = new byte[1024];

            // Keep listening to the InputStream while connected
            while (true) {
                if (status == ConnectionStatus.CONNECTED) {
                    try {
                        // Read from the InputStream
                        int length = socketInputStream.read(bytesBuffer);
                        String data = new String(bytesBuffer, 0, length);
                        appendToBuffer(data);
                    } catch (IOException e) {
                        Log.e(TAG, "disconnected", e);
                        break;
                    }
                }
            }
            Log.i(TAG, "END connectedThread");
        }

        private void appendToBuffer(String data) {
            synchronized (this.readBuffer) {
                this.readBuffer.append(data);
            }
            if (this.enabledNotifications) {
                while (this.readBuffer.indexOf(this.notificationDelimiter) >= 0) {
                    String value = readUntil(this.notificationDelimiter);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        notificationCallback.accept(value);
                    }
                }
            }
        }

        public synchronized String read() {
            String data;
            synchronized (readBuffer) {
                int index = readBuffer.length();

                data = readBuffer.substring(0, index);
                readBuffer.delete(0, index);
            }

            return data;
        }

        public synchronized String readUntil(String delimiter) {
            String data = "";
            synchronized (readBuffer) {
                int index = readBuffer.indexOf(delimiter);

                if (index >= 0) {
                    index += delimiter.length();
                    data = readBuffer.substring(0, index);
                    readBuffer.delete(0, index+1);
                }
            }

            return data;
        }

        public synchronized void startNotifications(String delimiter, Consumer<String> callback) {
            enabledNotifications = true;
            this.notificationDelimiter = delimiter;
            this.notificationCallback = callback;
        }

        public synchronized void stopNotifications() {
            enabledNotifications = false;
        }


        /**
         * Write to the connected OutStream.
         * @param buffer  The bytes to write
         */
        public void write(byte[] buffer) {
            try {
                socketOutputStream.write(buffer);
            } catch (IOException e) {
                Log.e(TAG, "Exception during write", e);
                /*reconnect();
                try {
                    outStream.write(buffer);
                } catch (IOException ex) {
                    Log.e(TAG, "Exception during write again. Closing...", e);
                    // TODO - encerrar thread
                }*/
            }
        }

        public boolean disconnect() {
            try {
                socket.close();
            } catch (IOException e) {
                Log.e(TAG, "close() of connect socket failed", e);
                return false;
            }

            return true;
        }

        public void reconnect() {
            try {
                socket.close();
            } catch (IOException io) {
                Log.e(TAG, "Error closing connection", io);
            }

            createRfcomm(device, secure);
            socketInputStream = getInputStream(socket);
            socketOutputStream = getOutputStream(socket);

        }

        private void connected() {
            Log.d(TAG, "Connected");
            status = ConnectionStatus.CONNECTED;
            this.plugin.connected();
        }

        private void connectionFailed() {
            Log.e(TAG, "Connection Failed for device " + device.getAddress());
            status = ConnectionStatus.NOT_CONNECTED;

            this.plugin.connectionFailed();
        }

        public boolean isConnected() {
            return socket.isConnected();
        }

        private InputStream getInputStream(BluetoothSocket socket) {
            try {
                return socket.getInputStream();
            } catch (IOException e) {
                Log.e(TAG, "Erro ao obter inputStream", e);
            }

            return null;
        }

        private OutputStream getOutputStream(BluetoothSocket socket) {
            try {
                return socket.getOutputStream();
            } catch (IOException e) {
                Log.e(TAG, "Erro ao obter outputStream", e);
            }

            return null;
        }
    }
}
