const { create } = require('ipfs-http-client');
const axios = require('axios');

app.post('/register-face', async (req, res) => {
  const imageBuffer = req.files.image.data; // Imagem enviada pelo Flutter

  try {
    // Enviar a imagem para o CompreFace para armazenar o template facial
    const response = await axios.post(
      'http://compreface-container/api/v1/faces',
      { image: imageBuffer },
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    if (response.data.success) {
      res.status(200).send({ message: 'Face registrada com sucesso!' });
    } else {
      res.status(500).send({ error: 'Erro ao registrar face' });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});
