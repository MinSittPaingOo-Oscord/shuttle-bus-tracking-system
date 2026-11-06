import 'package:flutter/material.dart';

import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/start_trip_screen.dart';
import 'screens/trip_screen.dart';

void main() {
  runApp(const TramTrackingApp());
}

class TramTrackingApp extends StatelessWidget {
  const TramTrackingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Tram Tracking',
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const HomeScreen(),
        '/start-trip': (context) => const StartTripScreen(),
        '/trip': (context) => const TripScreen(),
      },
    );
  }
}