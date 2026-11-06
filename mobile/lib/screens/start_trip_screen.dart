import 'package:flutter/material.dart';

import '../models/vehicle.dart';
import '../models/route.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/trip_service.dart';

class StartTripScreen extends StatefulWidget {
  const StartTripScreen({super.key});

  @override
  State<StartTripScreen> createState() => _StartTripScreenState();
}

class _StartTripScreenState extends State<StartTripScreen> {
  TramRoute? selectedRoute;
  Vehicle? loggedInVehicle;
  List<TramRoute> availableRoutes = [];
  Map<String, dynamic>? activeTrip;

  bool isStartingTrip = false;
  String? errorMessage;

  late Future<List<dynamic>> _dataFuture;

  @override
  void initState() {
    super.initState();
    _dataFuture = _loadData();
  }

  Future<List<dynamic>> _loadData() async {
    final results = await Future.wait([
      ApiService.getVehicles(),
      ApiService.getRoutes(),
    ]);

    final vehicles = results[0] as List<Vehicle>;
    final routes = results[1] as List<TramRoute>;

    final vehicleId = AuthService.vehicleId;

    if (vehicleId == null) {
      throw Exception('No logged-in vehicle');
    }

    final vehicle = vehicles.where((v) => v.id == vehicleId).firstOrNull;

    if (vehicle == null) {
      throw Exception('Logged-in vehicle not found');
    }

    final currentActiveTrip = await TripService.getActiveTrip();

    loggedInVehicle = vehicle;
    availableRoutes = routes;
    activeTrip = currentActiveTrip;

    return [vehicle, routes, currentActiveTrip];
  }

  TramRoute? _routeForTrip(List<TramRoute> routes, Map<String, dynamic>? trip) {
    final routeId = trip?['routeId']?.toString();

    if (routeId == null) {
      return null;
    }

    return routes.where((route) => route.id == routeId).firstOrNull;
  }

  void _openTripScreen({
    required Vehicle vehicle,
    required List<TramRoute> routes,
    required Map<String, dynamic>? trip,
    TramRoute? fallbackRoute,
  }) {
    final tripRoute = _routeForTrip(routes, trip) ?? fallbackRoute;

    Navigator.pushReplacementNamed(
      context,
      '/trip',
      arguments: {'vehicle': vehicle, 'route': tripRoute, 'trip': trip},
    );
  }

  Future<void> startTrip() async {
    if (selectedRoute == null) {
      setState(() {
        errorMessage = 'Please select a route';
      });
      return;
    }

    setState(() {
      isStartingTrip = true;
      errorMessage = null;
    });

    try {
      final trip = await TripService.startTrip(routeId: selectedRoute!.id);

      if (!mounted) return;

      activeTrip = trip;

      _openTripScreen(
        vehicle: loggedInVehicle!,
        routes: availableRoutes,
        trip: trip,
        fallbackRoute: selectedRoute,
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          isStartingTrip = false;
        });
      }
    }
  }

  Future<void> resumeActiveTrip() async {
    if (loggedInVehicle == null) {
      setState(() {
        errorMessage = 'Logged-in vehicle not found';
      });
      return;
    }

    setState(() {
      isStartingTrip = true;
      errorMessage = null;
    });

    try {
      final trip = activeTrip ?? await TripService.getActiveTrip();

      if (trip == null) {
        if (!mounted) return;

        setState(() {
          errorMessage = 'No active trip found';
        });
        return;
      }

      if (!mounted) return;

      activeTrip = trip;

      _openTripScreen(
        vehicle: loggedInVehicle!,
        routes: availableRoutes,
        trip: trip,
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          isStartingTrip = false;
        });
      }
    }
  }

  Future<void> retry() async {
    setState(() {
      _dataFuture = _loadData();
      errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Start Trip')),
      body: FutureBuilder<List<dynamic>>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('${snapshot.error}', textAlign: TextAlign.center),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: retry,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final vehicle = snapshot.data![0] as Vehicle;
          final routes = snapshot.data![1] as List<TramRoute>;
          final currentActiveTrip = snapshot.data![2] as Map<String, dynamic>?;

          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Vehicle',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),

                Card(
                  child: ListTile(
                    leading: const Icon(Icons.directions_bus),
                    title: Text(vehicle.name),
                    subtitle: Text(vehicle.id),
                  ),
                ),

                if (currentActiveTrip != null) ...[
                  const SizedBox(height: 20),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.trip_origin),
                            title: const Text('Active trip in progress'),
                            subtitle: Text(
                              'Trip ID: ${currentActiveTrip['id'] ?? '-'}',
                            ),
                          ),
                          ElevatedButton.icon(
                            onPressed: isStartingTrip ? null : resumeActiveTrip,
                            icon: const Icon(Icons.play_circle),
                            label: Text(
                              isStartingTrip
                                  ? 'Resuming Trip...'
                                  : 'Resume Active Trip',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 25),

                const Text(
                  'Select Route',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),

                DropdownButtonFormField<TramRoute>(
                  initialValue: selectedRoute,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.alt_route),
                  ),
                  hint: const Text('Choose route'),
                  items: routes.map((route) {
                    return DropdownMenuItem<TramRoute>(
                      value: route,
                      child: Text(route.name),
                    );
                  }).toList(),
                  onChanged: isStartingTrip
                      ? null
                      : (route) {
                          setState(() {
                            selectedRoute = route;
                            errorMessage = null;
                          });
                        },
                ),

                if (errorMessage != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    errorMessage!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.red),
                  ),
                ],

                const Spacer(),

                ElevatedButton.icon(
                  onPressed: isStartingTrip ? null : startTrip,
                  icon: const Icon(Icons.play_arrow),
                  label: Text(
                    isStartingTrip ? 'Starting Trip...' : 'Start Trip',
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
