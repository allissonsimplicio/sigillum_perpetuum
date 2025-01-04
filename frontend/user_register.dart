import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';

class DocumentUpload extends StatefulWidget {
  @override
  _DocumentUploadState createState() => _DocumentUploadState();
}

class _DocumentUploadState extends State<DocumentUpload> {
  XFile? _frontImage;
  XFile? _backImage;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickFrontImage() async {
    final pickedFile = await _picker.pickImage(source: ImageSource.camera);
    setState(() {
      _frontImage = pickedFile;
    });
  }

  Future<void> _pickBackImage() async {
    final pickedFile = await _picker.pickImage(source: ImageSource.camera);
    setState(() {
      _backImage = pickedFile;
    });
  }

  Future<void> _submitDocuments() async {
    if (_frontImage != null && _backImage != null) {
      // Processar as imagens de forma segura
      // Enviar para o servidor ou processar localmente
      // Implementar lógica adicional conforme necessário
      print("Documentos enviados com sucesso!");
    } else {
      print("Por favor, capture ambas as imagens.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Upload de Documento"),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: _pickFrontImage,
              child: Text("Tirar Foto da Frente do Documento"),
            ),
            if (_frontImage != null)
              Image.file(
                File(_frontImage!.path),
                height: 200,
              ),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: _pickBackImage,
              child: Text("Tirar Foto do Verso do Documento"),
            ),
            if (_backImage != null)
              Image.file(
                File(_backImage!.path),
                height: 200,
              ),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: _submitDocuments,
              child: Text("Enviar Documentos"),
            ),
          ],
        ),
      ),
    );
  }
}