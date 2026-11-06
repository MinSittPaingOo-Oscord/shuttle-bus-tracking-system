import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'auth_service.dart';

class TripService {
  static const String baseUrl = AppConfig.backendUrl;

  static String? activeTripId;

  static Map<String, dynamic> _decodeObject(http.Response response) {
    if (response.body.trim().isEmpty) {
      return {};
    }

    final decoded = jsonDecode(response.body);

    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    if (decoded is Map) {
      return Map<String, dynamic>.from(decoded);
    }

    return {};
  }

  static Map<String, dynamic>? _asStringMap(dynamic value) {
    if (value == null) {
      return null;
    }

    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return null;
  }

  static Map<String, dynamic> _saveActiveTrip(Map<String, dynamic> trip) {
    final id = trip['id'];

    if (id == null) {
      throw Exception('Active trip response missing id');
    }

    activeTripId = id.toString();

    return trip;
  }

  static Future<Map<String, dynamic>> startTrip({
    required String routeId,
  }) async {
    final token = AuthService.token;

    if (token == null) {
      throw Exception('Not logged in');
    }

    final response = await http.post(
      Uri.parse('$baseUrl/api/trips/start'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'routeId': routeId}),
    );

    final data = _decodeObject(response);

    if (response.statusCode == 201) {
      final newTrip =
          _asStringMap(data['trip']) ??
          _asStringMap(data['activeTrip']) ??
          data;

      return _saveActiveTrip(newTrip);
    }

    if (response.statusCode == 409) {
      final existingTrip =
          _asStringMap(data['trip']) ?? _asStringMap(data['activeTrip']);

      if (existingTrip != null) {
        return _saveActiveTrip(existingTrip);
      }

      final activeTrip = await getActiveTrip();

      if (activeTrip != null) {
        return activeTrip;
      }
    }

    throw Exception(data['error'] ?? 'Failed to start trip');
  }

  static Future<Map<String, dynamic>?> getActiveTrip() async {
    final token = AuthService.token;

    if (token == null) {
      throw Exception('Not logged in');
    }

    final response = await http.get(
      Uri.parse('$baseUrl/api/trips/active'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 404 || response.statusCode == 204) {
      activeTripId = null;
      return null;
    }

    final data = _decodeObject(response);

    if (response.statusCode != 200) {
      throw Exception(data['error'] ?? 'Failed to get active trip');
    }

    final activeTrip =
        _asStringMap(data['activeTrip']) ?? _asStringMap(data['trip']);

    if (activeTrip == null) {
      activeTripId = null;
      return null;
    }

    return _saveActiveTrip(activeTrip);
  }

  static Future<Map<String, dynamic>> endTrip() async {
    final token = AuthService.token;
    final tripId = activeTripId;

    if (token == null) {
      throw Exception('Not logged in');
    }

    if (tripId == null) {
      throw Exception('No active trip');
    }

    final response = await http.post(
      Uri.parse('$baseUrl/api/trips/$tripId/end'),
      headers: {'Authorization': 'Bearer $token'},
    );

    final data = _decodeObject(response);

    if (response.statusCode != 200) {
      throw Exception(data['error'] ?? 'Failed to end trip');
    }

    activeTripId = null;

    return Map<String, dynamic>.from(data);
  }
}
