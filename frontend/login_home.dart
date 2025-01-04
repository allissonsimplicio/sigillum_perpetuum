import 'package:flutter/material.dart';
import 'package:openid_client/openid_client_io.dart';
import 'package:url_launcher/url_launcher.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  final String issuerUrl = 'https://example-keycloak-server.com/realms/example-realm';
  final String clientId = 'example-client';

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: KeycloakLogin(
        issuerUrl: issuerUrl,
        clientId: clientId,
      ),
    );
  }
}

class KeycloakLogin extends StatefulWidget {
  final String issuerUrl;
  final String clientId;

  KeycloakLogin({required this.issuerUrl, required this.clientId});

  @override
  _KeycloakLoginState createState() => _KeycloakLoginState();
}

class _KeycloakLoginState extends State<KeycloakLogin> {
  bool isLoading = false;
  String? errorMessage;

  Future<void> authenticate() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      // Descoberta do provedor
      var issuer = await Issuer.discover(Uri.parse(widget.issuerUrl));

      // Configuração do cliente
      var client = Client(issuer, widget.clientId);

      // Criação da autenticação
      var authenticator = Authenticator(
        client,
        scopes: ['openid', 'profile', 'email'],
        port: 4000,
        urlLancher: (url) async {
          if (await canLaunch(url.toString())) {
            await launch(url.toString(), enableJavaScript: true);
          } else {
            throw 'Could not launch $url';
          }
        },
      );

      // Início da autenticação
      var c = await authenticator.authorize();

      // Fechamento do WebView
      closeWebView();

      // Obtenção do token
      var token = await c.getTokenResponse();

      // Navegação para a tela principal
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => HomePage(token: token)),
      );
    } catch (e) {
      setState(() {
        errorMessage = 'Erro ao autenticar: $e';
      });
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Login com Keycloak"),
      ),
      body: Center(
        child: isLoading
            ? CircularProgressIndicator()
            : ElevatedButton(
                onPressed: authenticate,
                child: Text("Login com Keycloak"),
              ),
      ),
      bottomNavigationBar: errorMessage != null
          ? Padding(
              padding: const EdgeInsets.all(8.0),
              child: Text(
                errorMessage!,
                style: TextStyle(color: Colors.red),
                textAlign: TextAlign.center,
              ),
            )
          : null,
    );
  }
}

class HomePage extends StatelessWidget {
  final TokenResponse token;

  HomePage({required this.token});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Página Inicial"),
      ),
      body: Center(
        child: Text("Bem-vindo! Token: ${token.accessToken}"),
      ),
    );
  }
}