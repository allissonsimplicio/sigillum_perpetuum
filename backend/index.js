const express = require('express');
const Web3 = require('web3');
const { create } = require('ipfs-http-client');
const stripe = require('stripe')('YOUR_STRIPE_SECRET_KEY');

const app = express();
const port = 4000;

// Configurar IPFS
const ipfs = create('http://localhost:5001');

// Configurar Web3 para a rede Polygon (Mumbai)
const web3 = new Web3('https://rpc-mumbai.maticvigil.com/');

// Endpoint para registro de documentos
app.post('/register-document', async (req, res) => {
  const { documentContent, userAddress } = req.body;

  // Fazer upload do documento para o IPFS
  try {
    const result = await ipfs.add(documentContent);
    const ipfsHash = result.path;

    // Registrar na blockchain usando Web3
    const contractAddress = '0xYourContractAddress'; // Endereço do contrato em Mumbai
    const contractAbi = require('./contractAbi.json'); // ABI do contrato
    const contract = new web3.eth.Contract(contractAbi, contractAddress);

    const tx = contract.methods.notarizeDocument(ipfsHash);
    const gas = await tx.estimateGas({ from: userAddress });
    const txHash = await tx.send({ from: userAddress, gas });

    res.send({ success: true, txHash });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`);
});