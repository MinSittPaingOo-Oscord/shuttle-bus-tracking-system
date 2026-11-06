import 'package:flutter/material.dart';

import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final sourceIdController = TextEditingController();
  final secretController = TextEditingController();

  bool isLoading = false;
  String? errorMessage;

  Future<void> login() async {
    final sourceId = sourceIdController.text.trim();
    final secret = secretController.text.trim();

    if (sourceId.isEmpty || secret.isEmpty) {
      setState(() {
        errorMessage = 'Please enter Source ID and Secret';
      });
      return;
    }

    if (sourceId.contains(RegExp(r'[oO]'))) {
      setState(() {
        errorMessage = 'Source ID must use zero 0, not letter O. Try TS01.';
      });
      return;
    }

    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      await AuthService.login(sourceId: sourceId, secret: secret);

      if (!mounted) return;

      Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      if (!mounted) return;

      setState(() {
        errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    sourceIdController.dispose();
    secretController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tram Tracking')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Vehicle Login',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 30),

                TextField(
                  controller: sourceIdController,
                  autocorrect: false,
                  enableSuggestions: false,
                  textCapitalization: TextCapitalization.none,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Source ID',
                    hintText: 'TS01',
                    helperText: 'Use zero 0, not letter O',
                    border: OutlineInputBorder(),
                  ),
                ),

                const SizedBox(height: 16),

                TextField(
                  controller: secretController,
                  obscureText: true,
                  autocorrect: false,
                  enableSuggestions: false,
                  textCapitalization: TextCapitalization.none,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => isLoading ? null : login(),
                  decoration: const InputDecoration(
                    labelText: 'Secret',
                    border: OutlineInputBorder(),
                  ),
                ),

                const SizedBox(height: 16),

                if (errorMessage != null)
                  Text(
                    errorMessage!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.red),
                  ),

                const SizedBox(height: 20),

                ElevatedButton(
                  onPressed: isLoading ? null : login,
                  child: Text(isLoading ? 'Logging in...' : 'Login'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
