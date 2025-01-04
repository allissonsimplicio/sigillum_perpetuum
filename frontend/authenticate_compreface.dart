import 'package:local_auth/local_auth.dart';
import 'package:flutter/material.dart';

final LocalAuthentication auth = LocalAuthentication();

Future<void> authenticate(BuildContext context) async {
  bool authenticated = false;
  try {
    authenticated = await auth.authenticate(
      localizedReason: 'Por favor, autentique-se para acessar o aplicativo',
      options: const AuthenticationOptions(
        biometricOnly: true,
      ),
    );
  } catch (e) {
    print('Erro durante a autenticação: $e');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Erro durante a autenticação: $e')),
    );
  }
  if (authenticated) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Autenticação bem-sucedida!')),
    );
    // Acesso permitido
  } else {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Falha na autenticação. Tente novamente.')),
    );
  }
}