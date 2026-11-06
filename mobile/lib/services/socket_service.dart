import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/app_config.dart';
import 'auth_service.dart';

class SocketService {
  static const String baseUrl = AppConfig.backendUrl;

  static io.Socket? _socket;
  static bool _isConnecting = false;
  static Map<String, dynamic>? _pendingLocation;

  static bool get isConnected => _socket?.connected ?? false;

  static void connect() {
    final token = AuthService.token;

    if (token == null) {
      throw Exception('Not logged in');
    }

    if (_socket?.connected == true || _isConnecting) {
      return;
    }

    _socket?.dispose();
    _socket = null;

    _socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );

    _socket!.onConnect((_) {
      _isConnecting = false;
      debugPrint('Socket connected');

      final pendingLocation = _pendingLocation;
      if (pendingLocation != null) {
        _emitLocation(pendingLocation);
        _pendingLocation = null;
      }
    });

    _socket!.onConnectError((error) {
      _isConnecting = false;
      debugPrint('Socket connection error: $error');
    });

    _socket!.onError((error) {
      _isConnecting = false;
      debugPrint('Socket error: $error');
    });

    _socket!.onDisconnect((_) {
      _isConnecting = false;
      debugPrint('Socket disconnected');
    });

    _isConnecting = true;
    _socket!.connect();
  }

  static void sendLocation({
    required double lat,
    required double lng,
    double? speed,
    double? heading,
  }) {
    final payload = {
      'lat': lat,
      'lng': lng,
      'speed': speed,
      'heading': heading,
    };

    if (_socket?.connected != true) {
      _pendingLocation = payload;
      return;
    }

    _emitLocation(payload);
  }

  static void disconnect() {
    _isConnecting = false;
    _pendingLocation = null;
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  static void _emitLocation(Map<String, dynamic> payload) {
    _socket!.emit('location:update', payload);
  }
}
