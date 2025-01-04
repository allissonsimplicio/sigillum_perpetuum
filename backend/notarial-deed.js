const axios = require('axios');
const { PDFDocument, rgb } = require('pdf-lib');
const { create } = require('ipfs-http-client');
const { Pool } = require('pg');
const Web3 = require('web3');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const secretKey = 'your-secret-key';

// Configurar IPFS
const ipfs = create('http://ipfs:5001');

// Configurar Web3 para a rede Polygon (Mumbai)
const web3 = new Web3('http://polygon:8545');

// Configurar PostgreSQL
const pool = new Pool({
  user: 'myuser',
  host: 'localhost',
  database: 'mydatabase',
  password: 'mypassword',
  port: 5432,
});

// Função para coletar mensagens do WhatsApp
async function collectWhatsAppMessages(userId) {
  // Implementar a coleta de mensagens do WhatsApp usando a API oficial
  // Exemplo:
  const response = await axios.get(`https://api.whatsapp.com/v1/messages?user_id=${userId}`, {
    headers: {
      'Authorization': `Bearer YOUR_WHATSAPP_API_KEY`,
    },
  });
  return response.data;
}

// Função para coletar mensagens do Messenger
async function collectMessengerMessages(userId) {
  // Implementar a coleta de mensagens do Messenger usando a API oficial
  // Exemplo:
  const response = await axios.get(`https://graph.facebook.com/v12.0/${userId}/messages`, {
    headers: {
      'Authorization': `Bearer YOUR_FACEBOOK_API_KEY`,
    },
  });
  return response.data;
}

// Função para coletar mensagens do Instagram Direct
async function collectInstagramDirectMessages(userId) {
  // Implementar a coleta de mensagens do Instagram Direct usando a API oficial
  // Exemplo:
  const response = await axios.get(`https://graph.instagram.com/v12.0/${userId}/messages`, {
    headers: {
      'Authorization': `Bearer YOUR_INSTAGRAM_API_KEY`,
    },
  });
  return response.data;
}

// Função para coletar emails
async function collectEmails(userId) {
  // Implementar a coleta de emails usando a API oficial do provedor de email
  // Exemplo:
  const response = await axios.get(`https://api.emailprovider.com/v1/emails?user_id=${userId}`, {
    headers: {
      'Authorization': `Bearer YOUR_EMAIL_API_KEY`,
    },
  });
  return response.data;
}

// Função para coletar conteúdos postados no Instagram
async function collectInstagramPosts(userId) {
  // Implementar a coleta de conteúdos postados no Instagram usando a API oficial
  // Exemplo:
  const response = await axios.get(`https://graph.instagram.com/v12.0/${userId}/media`, {
    headers: {
      'Authorization': `Bearer YOUR_INSTAGRAM_API_KEY`,
    },
  });
  return response.data;
}

// Função para coletar conteúdos postados no Facebook
async function collectFacebookPosts(userId) {
  // Implementar a coleta de conteúdos postados no Facebook usando a API oficial
  // Exemplo:
  const response = await axios.get(`https://graph.facebook.com/v12.0/${userId}/posts`, {
    headers: {
      'Authorization': `Bearer YOUR_FACEBOOK_API_KEY`,
    },
  });
  return response.data;
}

// Função para registrar mensagens e conteúdos na blockchain
async function registerContentInBlockchain(content, userId) {
  // Obter a carteira do usuário do banco de dados
  const result = await pool.query('SELECT address, private_key FROM users WHERE id = $1', [userId]);
  const userWallet = result.rows[0];

  // Fazer upload do conteúdo para o IPFS
  const ipfsResult = await ipfs.add(content);
  const ipfsHash = ipfsResult.path;

  // Registrar na blockchain usando Web3
  const contractAddress = '0xYourContractAddress'; // Endereço do contrato em Mumbai
  const contractAbi = require('./contractAbi.json'); // ABI do contrato
  const contract = new web3.eth.Contract(contractAbi, contractAddress);

  const contentHash = web3.utils.sha3(ipfsHash);
  const tx = contract.methods.notarize(contentHash, userWallet.address);
  const gas = await tx.estimateGas({ from: userWallet.address });
  const txHash = await tx.send({ from: userWallet.address, gas });

  // Adicionar log de auditoria
  await pool.query(
    'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
    [userId, 'register_content', JSON.stringify({ ipfsHash, txHash })]
  );

  // Adicionar selo e marca d'água ao conteúdo
  const watermarkText = `Selo: ${txHash}\nData: ${new Date().toISOString()}`;
  const signedContent = await addWatermark(content, watermarkText);

  return { txHash, ipfsHash, signedContent };
}

// Função para adicionar marca d'água
async function addWatermark(content, watermarkText) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.drawText(content, {
    x: 50,
    y: page.getHeight() - 50,
    size: 12,
    color: rgb(0, 0, 0),
  });
  page.drawText(watermarkText, {
    x: 50,
    y: page.getHeight() - 100,
    size: 12,
    color: rgb(0.75, 0.75, 0.75),
    opacity: 0.5,
  });
  const modifiedPdfBytes = await pdfDoc.save();
  return modifiedPdfBytes;
}

// Endpoint para coletar e registrar mensagens e conteúdos
app.post('/collect-and-register', verifyToken, async (req, res) => {
  const { userId, source } = req.body;

  try {
    let content;
    switch (source) {
      case 'whatsapp':
        content = await collectWhatsAppMessages(userId);
        break;
      case 'messenger':
        content = await collectMessengerMessages(userId);
        break;
      case 'instagram_direct':
        content = await collectInstagramDirectMessages(userId);
        break;
      case 'email':
        content = await collectEmails(userId);
        break;
      case 'instagram_post':
        content = await collectInstagramPosts(userId);
        break;
      case 'facebook_post':
        content = await collectFacebookPosts(userId);
        break;
      default:
        return res.status(400).send({ success: false, message: 'Invalid source' });
    }

    const { txHash, ipfsHash, signedContent } = await registerContentInBlockchain(content, userId);

    res.send({ success: true, txHash, ipfsHash, document: signedContent });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

// Função para verificar o saldo antes de cada transação
async function verifyBalance(userId, gasPrice) {
  const result = await pool.query('SELECT matic_balance FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];

  if (user.matic_balance < gasPrice) {
    // Adicionar saldo à carteira do usuário se necessário
    await addBalanceToUserWallet(userId, 'mensal_10'); // Exemplo: adicionar saldo do plano mensal_10
  }
}

// Função para adicionar saldo à carteira do usuário conforme o plano adquirido
async function addBalanceToUserWallet(userId, plan) {
  const plans = {
    'mensal_10': 30,
    'mensal_20': 50,
    'anual_20': 25,
    'anual_40': 45,
    'premium_anual_100': 60,
    'corporativo': 'contact_commercial',
  };

  if (plans[plan] === 'contact_commercial') {
    return res.status(400).send({ success: false, message: 'Contact commercial for corporate plan' });
  }

  const amountInBRL = plans[plan];
  const amountInMatic = await convertToMatic(amountInBRL);

  // Transferir fundos para a carteira do administrador
  await transferFundsToAdmin(amountInMatic);

  // Adicionar saldo à carteira do usuário
  await pool.query(
    'UPDATE users SET matic_balance = matic_balance + $1 WHERE id = $2',
    [amountInMatic, userId]
  );
}

// Função para transferir fundos para a carteira do administrador
async function transferFundsToAdmin(amountInMatic) {
  const tx = web3.eth.sendTransaction({
    from: adminWallet.address,
    to: 'ADMIN_WALLET_ADDRESS',
    value: web3.utils.toWei(amountInMatic, 'ether'),
  });
  return tx;
}

// Função para converter saldo em Matic
async function convertToMatic(amountInBRL) {
  const maticPriceInBRL = await getMaticPriceInBRL();
  const amountInMatic = amountInBRL / maticPriceInBRL;
  return amountInMatic;
}

// Função para obter o preço atual do Matic em BRL
async function getMaticPriceInBRL() {
  try {
    const response = await axios.get('https://api.polygonscan.com/api?module=stats&action=maticprice&apikey=YOUR_POLYGONSCAN_API_KEY');
    const maticPriceInUSD = response.data.result.maticusd;
    const usdToBRLRate = await getUSDToBRLRate();
    return maticPriceInUSD * usdToBRLRate;
  } catch (err) {
    throw new Error('Failed to get Matic price in BRL');
  }
}

// Função para obter a taxa de câmbio de USD para BRL
async function getUSDToBRLRate() {
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    return response.data.rates.BRL;
  } catch (err) {
    throw new Error('Failed to get USD to BRL rate');
  }
}

// Função para verificar o token
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send({ success: false, message: 'No token provided' });

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) return res.status(500).send({ success: false, message: 'Failed to authenticate token' });
    req.userId = decoded.userId;
    next();
  });
}

app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`);
});
