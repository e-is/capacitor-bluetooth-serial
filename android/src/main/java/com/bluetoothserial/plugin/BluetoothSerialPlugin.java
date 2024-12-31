package com.bluetoothserial.plugin;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.util.ArraySet;
import android.util.Log;

import com.bluetoothserial.BluetoothDeviceHelper;
import com.bluetoothserial.BluetoothSerialService;
import com.bluetoothserial.KeyConstants;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.util.ConcurrentModificationException;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

@CapacitorPlugin(
  name = "BluetoothSerial",
  permissions = {
    @Permission(
      strings = {
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.BLUETOOTH,
        Manifest.permission.BLUETOOTH_ADMIN
      },
      alias = BluetoothSerialPlugin.BLUETOOTH
    ),
    @Permission(
      strings = {Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN},
      alias = BluetoothSerialPlugin.BLUETOOTH_API_31
    )
  }
)
public class BluetoothSerialPlugin extends Plugin {

  // Permission alias constants
  public static final String BLUETOOTH = "bluetooth";
  public static final String BLUETOOTH_API_31 = "bluetooth-31";

  // Log tag
  private static final String TAG_PERMISSION = "permission";

  // Message constants
  private static final String ERROR_DISABLED = "Bluetooth is disabled";
  private static final String ERROR_PERMISSION_DENIED = "Bluetooth permission denied";
  private static final String ERROR_ADDRESS_MISSING = "Device address property is required";
  private static final String ERROR_DEVICE_NOT_FOUND = "Device not found";
  private static final String ERROR_SCAN_FAILED = "Failed to scan devices";
  private static final String ERROR_CONNECTION_FAILED = "Failed to connect to the device";
  private static final String ERROR_DISCONNECT_FAILED = "Failed to disconnect from the device";
  private static final String ERROR_WRITING = "Failed to send data to the device";

  private BluetoothAdapter bluetoothAdapter;
  private BluetoothSerialService service;
  private PluginCall connectCall;
  private BroadcastReceiver stateReceiver;

  @PluginMethod()
  public void isEnabled(PluginCall call) {
    boolean enabled = isEnabled();
    resolveState(call, enabled);
  }

  @PluginMethod()
  public void canEnable(PluginCall call) {
    resolveState(call, getCanEnable());
  }

  @PluginMethod()
  @SuppressLint("MissingPermission")
  public void enable(PluginCall call) {
    // Already enabled: ok
    if (isEnabled()) {
      resolveState(call, true);
      return;
    }

    // Version prior API 31 (S) and after or equals 33 (TIRAMISU) cannot enable bluetooth
    if (!getCanEnable()) {
      Log.w(getLogTag(), "Enabling bluetooth are not allowed by API " + Build.VERSION.SDK_INT + " - skipping");
      resolveState(call, false);
      return;
    }

    // Ask permission, and enable if need
    if (checkBluetoothPermissions(call)) {
      Log.d(getLogTag(), "Enabling bluetooth...");
      boolean enabled = bluetoothAdapter.enable();
      Log.d(getLogTag(), "Enabling bluetooth " + (enabled ? "[OK]" : "[KO]"));
      resolveState(call, enabled);
    }
  }

  @PluginMethod()
  @SuppressLint("MissingPermission")
  public void disable(PluginCall call) {
    // Already disabled: ok
    if (isDisabled()) {
      resolveState(call, false);
      return;
    }

    // Version prior API 31 (S) and after or equals 33 (TIRAMISU) cannot diable bluetooth
    if (!getCanEnable()) {
      Log.w(getLogTag(), "Enabling bluetooth are not allowed by API " + Build.VERSION.SDK_INT + " - skipping");
      resolveState(call, true);
      return;
    }

    // Ask permission, and enable if need
    if (checkBluetoothPermissions(call)) {
      Log.d(getLogTag(), "Disabling bluetooth...");
      boolean disabled = bluetoothAdapter.disable();
      resolveState(call, !disabled);
    }
  }

  @PluginMethod
  public void startEnabledNotifications(PluginCall call) {
    try {
      createStateReceiver();
      call.resolve();
    } catch (Exception e) {
      Log.e(getLogTag(), "Error while registering enabled state receiver: " + e.getLocalizedMessage(), e);
      call.reject("startEnabledNotifications failed.");
    }
  }

  private void createStateReceiver() {
    if (stateReceiver == null) {
      stateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
          String action = intent.getAction();

          if (action.equals(BluetoothAdapter.ACTION_STATE_CHANGED)) {
            int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
            boolean enabled = state == BluetoothAdapter.STATE_ON;
            JSObject result = new JSObject();
            result.put(KeyConstants.ENABLED, enabled);
            try {
              notifyListeners(KeyConstants.ENABLED_CHANGED_EVENT, result);
            } catch (ConcurrentModificationException e) {
              Log.e(getLogTag(), "Error in notifyListeners: " + e.getLocalizedMessage(), e);
            }
          }
        }
      };
      getContext().registerReceiver(stateReceiver, new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED));
    }
  }

  @PluginMethod
  public void stopEnabledNotifications(PluginCall call) {
    if (stateReceiver != null) {
      getContext().unregisterReceiver(stateReceiver);
      stateReceiver = null;
    }
    call.resolve();
  }

  @PluginMethod()
  @SuppressLint("MissingPermission")
  public void scan(PluginCall call) {
    if (rejectIfDisabled(call)) {
      return;
    }

    if (bluetoothAdapter.isDiscovering()) {
      boolean cancelled = bluetoothAdapter.cancelDiscovery();
      Log.d(getLogTag(), "Canceling previous scan... " + cancelled);
    }

    try {
      final Context context = getContext();

      BroadcastReceiver receiver = new BroadcastReceiver() {
        private Set<BluetoothDevice> devices = new HashSet<>();

        @Override
        public void onReceive(Context context, Intent intent) {
          String action = intent.getAction();

          switch (action) {
            case BluetoothDevice.ACTION_FOUND:
              BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
              devices.add(device);
              break;
            case BluetoothAdapter.ACTION_DISCOVERY_FINISHED:
              Log.d(getLogTag(), String.format("Scan finished: %s devices found", devices.size()));
              resolveScanDevices(call, devices);
              context.unregisterReceiver(this);
              break;
          }
        }
      };

      context.registerReceiver(receiver, new IntentFilter(BluetoothDevice.ACTION_FOUND));
      context.registerReceiver(receiver, new IntentFilter(BluetoothAdapter.ACTION_DISCOVERY_FINISHED));

      boolean started = bluetoothAdapter.startDiscovery();

      // Cancel after 5s (timeout)
      if (started) {
        new Handler().postDelayed(bluetoothAdapter::cancelDiscovery, 5000);
      }
      else {
        Log.d(getLogTag(), "Cannot scan bluetooth devices !");
        context.unregisterReceiver(receiver);
        call.reject(ERROR_SCAN_FAILED);
      }
    } catch (Exception e) {
      Log.e(getLogTag(), ERROR_SCAN_FAILED, e);
      call.reject(ERROR_SCAN_FAILED, e);
    }
  }

  @PluginMethod()
  public void connect(PluginCall call) {
    String address = getAddress(call);

    if (address == null) {
      call.reject(ERROR_ADDRESS_MISSING);
      return;
    }

    if (rejectIfDisabled(call)) {
      return;
    }

    BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
    if (device == null) {
      call.reject(ERROR_DEVICE_NOT_FOUND);
      return;
    }

        /* TODO - autoConnect
        Boolean autoConnect = call.getBoolean(keyAutoConnect);
        autoConnect = autoConnect == null ? false : autoConnect;
         */

    connectCall = call;
    getService().connect(device, this);
  }

  public void connected() {
    if (connectCall != null) {
      connectCall.resolve();
      connectCall = null;
    }
  }

  public void connectionFailed() {
    if (connectCall != null) {
      connectCall.reject(ERROR_CONNECTION_FAILED);
      connectCall = null;
    }
  }

  @PluginMethod()
  public void disconnect(PluginCall call) {
    String address = getAddress(call);
    boolean success;
    if (address == null) {
      success = getService().disconnectAllDevices();
    } else {
      success = getService().disconnect(address);
    }

    if (success) {
      call.resolve();
    } else {
      call.reject(ERROR_DISCONNECT_FAILED);
    }
  }

  @PluginMethod()
  public void isConnected(PluginCall call) {
    String address = getAddress(call);

    if (address == null) {
      call.reject(ERROR_ADDRESS_MISSING);
      return;
    }

    boolean connected = getService().isConnected(address);

    JSObject response = new JSObject();
    response.put(KeyConstants.CONNECTED, connected);
    call.resolve(response);
  }

  @PluginMethod()
  public void write(PluginCall call) {
    String address = getAddress(call);

    if (address == null) {
      call.reject(ERROR_ADDRESS_MISSING);
      return;
    }

    String value = call.getString(KeyConstants.VALUE);
    Log.i(getLogTag(), value);

    boolean success = getService().write(address, BluetoothDeviceHelper.toByteArray(value));

    if (success) {
      call.resolve();
    } else {
      call.reject(ERROR_WRITING);
    }
  }

  @PluginMethod()
  public void read(PluginCall call) {
    String address = getAddress(call);

    if (address == null) {
      call.reject(ERROR_ADDRESS_MISSING);
      return;
    }

    try {
      String value = getService().read(address);

      JSObject response = new JSObject();
      response.put(KeyConstants.VALUE, value);

      call.resolve(response);
    } catch (IOException e) {
      Log.e(getLogTag(), "Exception during read", e);
      call.reject("Exception during read", e);
    }
  }

  @PluginMethod()
  public void readUntil(PluginCall call) {
    String address = getAddress(call);

    if (address == null) {
      call.reject(ERROR_ADDRESS_MISSING);
      return;
    }

    String delimiter = getDelimiter(call);

    try {
      String value = getService().readUntil(address, delimiter);

      JSObject response = new JSObject();
      response.put(KeyConstants.VALUE, value);
      call.resolve(response);
    } catch (IOException e) {
      Log.e(getLogTag(), "Exception during readUntil", e);
      call.reject("Exception during readUntil", e);
    }
  }

  @PluginMethod()
  public void startNotifications(PluginCall call) {
    String address = getAddress(call);

    if (address == null) {
      call.reject(ERROR_ADDRESS_MISSING);
      return;
    }

    String delimiter = getDelimiter(call);

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        getService().startNotifications(address, delimiter, new Consumer<String>() {
          @Override
          public void accept(String value) {
            JSObject result = new JSObject();
            result.put(KeyConstants.VALUE, value);
            try {
              notifyListeners(KeyConstants.READ_EVENT, result);
            } catch (ConcurrentModificationException e) {
              Log.e(getLogTag(), "Error in notifyListeners: " + e.getLocalizedMessage(), e);
            }
          }
        });
        call.resolve();
      } else {
        call.reject("Required Android API >= " + android.os.Build.VERSION_CODES.N);
      }
    } catch (IOException e) {
      Log.e(getLogTag(), "Exception during startNotifications", e);
      call.reject("Exception during startNotifications", e);
    }
  }

  @PluginMethod()
  public void stopNotifications(PluginCall call) {
    String address = getAddress(call);

    if (address == null) {
      call.reject(ERROR_ADDRESS_MISSING);
      return;
    }

    try {
      getService().stopNotifications(address);

      call.resolve();
    } catch (IOException e) {
      Log.e(getLogTag(), "Exception during stopNotifications", e);
      call.reject("Exception during stopNotifications", e);
    }
  }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        initializeBluetoothAdapter();
        initializeService();
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();

        if (service != null) {
            getService().stopAll();
        }
    }

    @Override
    public Map<String, PermissionState> getPermissionStates() {
        Map<String, PermissionState> permissionStates = super.getPermissionStates();

        // If Bluetooth is not in the manifest and therefore not required, say the permission is granted
        String permissionAlias = getPermissionAlias();
        if (!isPermissionDeclared(permissionAlias)) {
            permissionStates.put(permissionAlias, PermissionState.GRANTED);
        }

        return permissionStates;
    }

  private boolean checkBluetoothPermissions(PluginCall call) {
    return checkPermissions(call, getPermissionAlias());
  }

  private boolean checkPermissions(PluginCall call, String permissionAlias) {
      if (getPermissionState(permissionAlias) != PermissionState.GRANTED) {
          Log.d(TAG_PERMISSION, "Asking for bluetooth permission ...");
          requestPermissionForAlias(permissionAlias, call, "bluetoothPermissionsCallback");
          return false;
      }

      return true;
    }

    /**
     * Completes the plugin call after a permission request
     *
     * @param call the plugin call
     */
    @PermissionCallback
    private void bluetoothPermissionsCallback(PluginCall call) {
      if (call == null) {
        Log.d(TAG_PERMISSION, "Bluetooth permission callback: missing plugin call (already resolved or rejected ?)");
        return;
      }

      if (getPermissionState() == PermissionState.GRANTED) {
        Log.d(TAG_PERMISSION, "Bluetooth permission granted");
        // Continue to the source method
        switch (call.getMethodName()) {
            case "disable":
                disable(call);
                break;
            case "scan":
                scan(call);
                break;
            case "connect":
                connect(call);
                break;
            case "enable":
            default:
                enable(call);
                break;
        }
      }
      else {
        Log.d(TAG_PERMISSION, ERROR_PERMISSION_DENIED);
        call.reject(ERROR_PERMISSION_DENIED);
      }
    }

    private boolean hasBluetoothFeature() {
        return getActivity().getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH);
    }

    private void resolveScanDevices(PluginCall call, Set<BluetoothDevice> devices) {
        JSObject response = new JSObject();
        JSArray devicesAsJson = BluetoothDeviceHelper.devicesToJSArray(devices);
        response.put("devices", devicesAsJson);
        call.resolve(response);
    }

    private void resolveState(PluginCall call, boolean enabled) {
        JSObject response = new JSObject();
        response.put(KeyConstants.ENABLED, enabled);
        call.resolve(response);
    }

    private boolean rejectIfDisabled(PluginCall call) {
        if (!checkBluetoothPermissions(call)) {
            return true;
        }

        if (isDisabled()) {
            Log.e(getLogTag(), ERROR_DISABLED);
            call.reject(ERROR_DISABLED);
            return true;
        }

        return false;
    }

    private boolean isEnabled() {
        return this.hasBluetoothFeature()
                && getPermissionState() == PermissionState.GRANTED
                && bluetoothAdapter.isEnabled();
    }

    private boolean isDisabled() {
        return !isEnabled();
    }

    private void initializeBluetoothAdapter() {
        bluetoothAdapter = getBluetoothManager().getAdapter();
    }

    private void initializeService() {
        if (service == null) {
            service = new BluetoothSerialService(this, bluetoothAdapter);
        }
    }

    private String getAddress(PluginCall call) {
        return getString(call, KeyConstants.ADDRESS_UUID);
    }

    private String getDelimiter(PluginCall call) {
        return getString(call, KeyConstants.DELIMITER);
    }

    private String getString(PluginCall call, String key) {
        return call.getString(key);
    }

    private BluetoothManager getBluetoothManager() {
        return (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
    }

    private BluetoothSerialService getService() {
        if (service == null) {
            initializeService();
        }

        return service;
    }

    private String getPermissionAlias() {
        String alias = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) ? BLUETOOTH_API_31 : BLUETOOTH;
        return alias;
    }

    private boolean getCanEnable() {
        // Version prior API 31 (S) and after or equals 33 (TIRAMISU) cannot enable bluetooth
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU;
    }

    private PermissionState getPermissionState() {
        return getPermissionState(getPermissionAlias());
    }

}
