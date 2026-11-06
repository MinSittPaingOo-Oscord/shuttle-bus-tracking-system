import 'package:flutter/material.dart';

import '../models/vehicle.dart';
import '../models/route.dart';
import '../models/stop.dart';
import '../services/api_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
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
      ApiService.getStops(),
    ]);

    return results;
  }

  Future<void> _refresh() async {
    setState(() {
      _dataFuture = _loadData();
    });

    try {
      await _dataFuture;
    } catch (_) {
      // FutureBuilder displays the loading error and retry action.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tram Tracking')),

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
                    const Icon(Icons.error_outline, size: 50),
                    const SizedBox(height: 10),
                    const Text(
                      'Failed to connect to backend',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text('${snapshot.error}', textAlign: TextAlign.center),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: _refresh,
                      child: const Text('Try Again'),
                    ),
                  ],
                ),
              ),
            );
          }

          final vehicles = snapshot.data![0] as List<Vehicle>;
          final routes = snapshot.data![1] as List<TramRoute>;
          final stops = snapshot.data![2] as List<TramStop>;

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Vehicles',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),

                const SizedBox(height: 10),

                ...vehicles.map(
                  (vehicle) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.directions_bus),
                      title: Text(vehicle.name),
                      subtitle: Text('${vehicle.type} • ${vehicle.status}'),
                      trailing: Text(vehicle.id),
                    ),
                  ),
                ),

                const SizedBox(height: 25),

                const Text(
                  'Routes',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),

                const SizedBox(height: 10),

                ...routes.map(
                  (route) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.alt_route),
                      title: Text(route.name),
                      subtitle: Text('Status: ${route.status}'),
                      trailing: Text(route.id),
                    ),
                  ),
                ),

                const SizedBox(height: 25),

                const Text(
                  'Stops',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),

                const SizedBox(height: 10),

                ...stops.map(
                  (stop) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.location_on),
                      title: Text(stop.nameEn),
                      subtitle: Text(
                        '${stop.nameTh}\n'
                        '${stop.lat}, ${stop.lng}',
                      ),
                      isThreeLine: true,
                      trailing: Text(stop.id),
                    ),
                  ),
                ),

                const SizedBox(height: 80),
              ],
            ),
          );
        },
      ),

      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.pushNamed(context, '/start-trip');
        },
        icon: const Icon(Icons.play_arrow),
        label: const Text('Start Trip'),
      ),
    );
  }
}
