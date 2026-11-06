import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';

class AuthService {
  static const String baseUrl = AppConfig.backendUrl;

  static String? token;
  static String? vehicleId;
  static String? sourceId;

  static bool get isLoggedIn => token != null;

  static Future<void> login({
    required String sourceId,
    required String secret,
  }) async {
    final trimmedSourceId = sourceId.trim();
    final trimmedSecret = secret.trim();
    final loginUrl = '$baseUrl/api/auth/vehicle/login';

    debugPrint('LOGIN URL: $loginUrl');
    debugPrint('LOGIN sourceId="$trimmedSourceId"');
    debugPrint('LOGIN secret length=${trimmedSecret.length}');

    final response = await http.post(
      Uri.parse(loginUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'sourceId': trimmedSourceId, 'secret': trimmedSecret}),
    );

    debugPrint('LOGIN status=${response.statusCode}');
    debugPrint('LOGIN response=${_safeResponseBody(response.body)}');

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode != 200) {
      throw Exception(data['error'] ?? data['message'] ?? 'Login failed');
    }

    token = data['token'];
    AuthService.sourceId = data['sourceId'];
    vehicleId = data['vehicleId'];

    if (token == null) {
      throw Exception('Backend did not return a token');
    }
  }

  static void logout() {
    token = null;
    sourceId = null;
    vehicleId = null;
  }

  static String _safeResponseBody(String body) {
    try {
      final decoded = jsonDecode(body);

      if (decoded is Map<String, dynamic>) {
        final sanitized = Map<String, dynamic>.from(decoded);

        if (sanitized.containsKey('token')) {
          sanitized['token'] = '<redacted>';
        }

        return jsonEncode(sanitized);
      }
    } catch (_) {
      return body;
    }

    return body;
  }
}
