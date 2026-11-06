import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/vehicle.dart';
import '../models/route.dart';
import '../models/stop.dart';
import '../models/route_stop.dart';
import '../config/app_config.dart';

class ApiService {
  static const String baseUrl = AppConfig.backendUrl;

  static Future<List<TramRoute>> getRoutes() async {
    final response = await http.get(Uri.parse('$baseUrl/api/routes'));

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);

      return data.map((json) => TramRoute.fromJson(json)).toList();
    }

    throw Exception('Failed to load routes');
  }

  static Future<List<Vehicle>> getVehicles() async {
    final response = await http.get(Uri.parse('$baseUrl/api/vehicles'));

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);

      return data.map((json) => Vehicle.fromJson(json)).toList();
    }

    throw Exception('Failed to load vehicles');
  }

  static Future<List<TramStop>> getStops() async {
    final response = await http.get(Uri.parse('$baseUrl/api/stops'));

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);

      return data.map((json) => TramStop.fromJson(json)).toList();
    }

    throw Exception('Failed to load stops');
  }

  static Future<List<RouteStop>> getRouteStops() async {
    final response = await http.get(Uri.parse('$baseUrl/api/route-stops'));

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);

      return data.map((json) => RouteStop.fromJson(json)).toList();
    }

    throw Exception('Failed to load route stops');
  }
}
