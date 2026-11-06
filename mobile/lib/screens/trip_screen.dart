import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../models/vehicle.dart';
import '../models/route.dart';
import '../services/socket_service.dart';
import '../services/trip_service.dart';

class TripScreen extends StatefulWidget {
  const TripScreen({super.key});

  @override
  State<TripScreen> createState() => _TripScreenState();
}

class _TripScreenState extends State<TripScreen> {
  StreamSubscription<Position>? _positionSubscription;

  String locationText = 'Starting GPS tracking...';
  bool loadingLocation = false;
  bool gpsTracking = false;
  bool endingTrip = false;
  String? errorMessage;

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      startGpsTracking();
    });
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    SocketService.disconnect();
    super.dispose();
  }

  Future<bool> _ensureLocationReady() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();

    if (!serviceEnabled) {
      if (!mounted) return false;

      setState(() {
        locationText = 'Location service is disabled';
      });
      return false;
    }

    var permission = await Geolocator.checkPermission();

    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      if (!mounted) return false;

      setState(() {
        locationText = 'Location permission denied';
      });
      return false;
    }

    if (permission == LocationPermission.deniedForever) {
      if (!mounted) return false;

      setState(() {
        locationText = 'Location permission permanently denied';
      });
      return false;
    }

    return true;
  }

  void _handlePosition(Position position) {
    SocketService.sendLocation(
      lat: position.latitude,
      lng: position.longitude,
      speed: position.speed,
      heading: position.heading,
    );

    if (!mounted) return;

    setState(() {
      gpsTracking = true;
      locationText =
          'Latitude: ${position.latitude}\n'
          'Longitude: ${position.longitude}';
    });
  }

  Future<void> startGpsTracking() async {
    if (_positionSubscription != null) {
      return;
    }

    setState(() {
      loadingLocation = true;
      errorMessage = null;
    });

    try {
      final locationReady = await _ensureLocationReady();

      if (!locationReady) {
        return;
      }

      SocketService.connect();

      final currentPosition = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      _handlePosition(currentPosition);

      _positionSubscription =
          Geolocator.getPositionStream(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 5,
            ),
          ).listen(
            _handlePosition,
            onError: (error) {
              if (!mounted) return;

              setState(() {
                gpsTracking = false;
                errorMessage = 'GPS tracking error: $error';
              });
            },
          );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        gpsTracking = false;
        locationText = 'Failed to start GPS tracking';
        errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          loadingLocation = false;
        });
      }
    }
  }

  Future<void> stopGpsTracking() async {
    await _positionSubscription?.cancel();
    _positionSubscription = null;
    SocketService.disconnect();

    if (!mounted) return;

    setState(() {
      gpsTracking = false;
    });
  }

  Future<void> endTrip() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('End Trip'),
          content: const Text('Are you sure you want to end this trip?'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context, false);
              },
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context, true);
              },
              child: const Text('End Trip'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) return;

    setState(() {
      endingTrip = true;
      errorMessage = null;
    });

    try {
      await TripService.endTrip();
      await stopGpsTracking();

      if (!mounted) return;

      Navigator.pushNamedAndRemoveUntil(context, '/home', (route) => false);
    } catch (e) {
      if (!mounted) return;

      setState(() {
        errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          endingTrip = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final arguments =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;

    final vehicle = arguments?['vehicle'] as Vehicle?;
    final route = arguments?['route'] as TramRoute?;

    return Scaffold(
      appBar: AppBar(title: const Text('Active Trip')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Trip Status: Active',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 20),

            Card(
              child: ListTile(
                leading: const Icon(Icons.directions_bus),
                title: Text(vehicle?.name ?? 'Unknown Vehicle'),
                subtitle: Text('Vehicle ID: ${vehicle?.id ?? '-'}'),
              ),
            ),

            Card(
              child: ListTile(
                leading: const Icon(Icons.alt_route),
                title: Text(route?.name ?? 'Unknown Route'),
                subtitle: Text('Route ID: ${route?.id ?? '-'}'),
              ),
            ),

            Card(
              child: ListTile(
                leading: const Icon(Icons.location_on),
                title: const Text('GPS Location'),
                subtitle: Text(
                  '$locationText\n'
                  'Tracking: ${gpsTracking ? 'active' : 'inactive'}',
                ),
              ),
            ),

            const SizedBox(height: 20),

            ElevatedButton.icon(
              onPressed: loadingLocation || gpsTracking
                  ? null
                  : startGpsTracking,
              icon: const Icon(Icons.my_location),
              label: Text(
                loadingLocation
                    ? 'Starting GPS...'
                    : gpsTracking
                    ? 'GPS Tracking Active'
                    : 'Start GPS Tracking',
              ),
            ),

            if (errorMessage != null) ...[
              const SizedBox(height: 15),
              Text(
                errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.red),
              ),
            ],

            const Spacer(),

            ElevatedButton.icon(
              onPressed: endingTrip ? null : endTrip,
              icon: const Icon(Icons.stop),
              label: Text(endingTrip ? 'Ending Trip...' : 'End Trip'),
            ),
          ],
        ),
      ),
    );
  }
}
