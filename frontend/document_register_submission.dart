import 'package:flutter/material.dart';
import 'package:web3dart/web3dart.dart';
import 'package:http/http.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';
import 'dart:io';

class ProofOfExistencePage extends StatefulWidget {
  @override
  _ProofOfExistencePageState createState() => _ProofOfExistencePageState();
}

class _ProofOfExistencePageState extends State<ProofOfExistencePage> {
  final TextEditingController _documentController = TextEditingController();
  final storage = FlutterSecureStorage();
  late Web3Client _client;
  bool isLoading = false;
  String? _resultMessage;

  final String _rpcUrl = "https://rinkeby.infura.io/v3/YOUR_INFURA_PROJECT_ID";
  final String _contractAddress = "0xYourContractAddress";

  late DeployedContract _contract;
  late ContractFunction _notarizeFunction;
  late ContractFunction _verifyFunction;
  late EthereumAddress _ownAddress;
  late Credentials _credentials;

  @override
  void initState() {
    super.initState();
    _client = Web3Client(_rpcUrl, Client());
    _initializeContract();
  }

  Future<void> _initializeContract() async {
    String abiString = await rootBundle.loadString('assets/ProofOfExistence.json');
    final abi = ContractAbi.fromJson(abiString, 'ProofOfExistence');

    _contract = DeployedContract(
      abi,
      EthereumAddress.fromHex(_contractAddress),
    );

    _notarizeFunction = _contract.function('notarize');
    _verifyFunction = _contract.function('verify');

    // Recuperar a chave privada de forma segura
    String? privateKey = await storage.read(key: 'privateKey');
    if (privateKey == null) {
      // Solicitar ao usuário que insira sua chave privada
      privateKey = await _askForPrivateKey();
      await storage.write(key: 'privateKey', value: privateKey);
    }

    _credentials = EthPrivateKey.fromHex(privateKey);
    _ownAddress = await _credentials.extractAddress();
  }

  Future<String> _askForPrivateKey() async {
    String privateKey = '';
    await showDialog(
      context: context,
      builder: (context) {
        TextEditingController _keyController = TextEditingController();
        return AlertDialog(
          title: Text('Insira sua Chave Privada'),
          content: TextField(
            controller: _keyController,
            obscureText: true,
            decoration: InputDecoration(hintText: 'Chave Privada'),
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                privateKey = _keyController.text;
                Navigator.of(context).pop();
              },
              child: Text('Confirmar'),
            ),
          ],
        );
      },
    );
    return privateKey;
  }

  Future<void> _registerDocument() async {
    setState(() {
      isLoading = true;
      _resultMessage = null;
    });

    try {
      String documentText = _documentController.text;
      if (documentText.isEmpty) {
        throw "O documento não pode estar vazio";
      }

      // Gerar hash do documento usando SHA-256
      var bytes = utf8.encode(documentText);
      var documentHash = sha256.convert(bytes).bytes;

      // Enviar transação
      var result = await _client.sendTransaction(
        _credentials,
        Transaction.callContract(
          contract: _contract,
          function: _notarizeFunction,
          parameters: [documentHash],
        ),
        chainId: 4, // Rinkeby Testnet
      );

      setState(() {
        _resultMessage = "Documento registrado com sucesso! TX Hash: $result";
      });
    } catch (e) {
      setState(() {
        _resultMessage = "Erro ao registrar documento: $e";
      });
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  Future<void> _verifyDocument() async {
    setState(() {
      isLoading = true;
      _resultMessage = null;
    });

    try {
      String documentText = _documentController.text;
      if (documentText.isEmpty) {
        throw "O documento não pode estar vazio";
      }

      // Gerar hash do documento usando SHA-256
      var bytes = utf8.encode(documentText);
      var documentHash = sha256.convert(bytes).bytes;

      // Chamar função de verificação
      var result = await _client.call(
        contract: _contract,
        function: _verifyFunction,
        params: [documentHash],
      );

      var timestamp = result.first as BigInt;

      if (timestamp == BigInt.zero) {
        _resultMessage = "Documento não encontrado na blockchain.";
      } else {
        DateTime date = DateTime.fromMillisecondsSinceEpoch(timestamp.toInt() * 1000);
        _resultMessage = "Documento registrado em: $date";
      }
    } catch (e) {
      setState(() {
        _resultMessage = "Erro ao verificar documento: $e";
      });
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _documentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Prova de Existência"),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextFormField(
              controller: _documentController,
              maxLines: 5,
              decoration: InputDecoration(
                labelText: 'Conteúdo do Documento',
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 16),
            isLoading ? CircularProgressIndicator() : SizedBox.shrink(),
            if (_resultMessage != null)
              Padding(
                padding: const EdgeInsets.all(8.0),
                child: Text(
                  _resultMessage!,
                  style: TextStyle(color: Colors.blue),
                ),
              ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                ElevatedButton(
                  onPressed: _registerDocument,
                  child: Text("Registrar Documento"),
                ),
                ElevatedButton(
                  onPressed: _verifyDocument,
                  child: Text("Verificar Documento"),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}