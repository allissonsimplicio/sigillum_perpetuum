const express = require('express');
const Tesseract = require('tesseract.js');
const multer = require('multer');
const { Pool } = require('pg');
const { Wallet, ethers } = require('ethers');
const Web3 = require('web3');
const { create } = require('ipfs-http-client');
const stripe = require('stripe')('YOUR_STRIPE_SECRET_KEY');
const stringSimilarity = require('string-similarity');
const { PDFDocument, rgb } = require('pdf-lib');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const secretKey = 'your-secret-key';
const { body, validationResult } = require('express-validator');
const winston = require('winston');
const axios = require('axios');

const app = express();
const port = 4000;

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

// Configurar Multer para upload de arquivos
const upload = multer({ dest: 'uploads/' });

// Função para gerar uma nova carteira
function generateWallet() {
  const wallet = Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
  };
}

// Função para comparar textos
function compareTexts(idText, selfieText) {
  // Remover acentos e pontos
  const cleanIdText = idText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '');
  const cleanSelfieText = selfieText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '');

  // Calcular a similaridade entre os textos
  const similarity = stringSimilarity.compareTwoStrings(cleanIdText, cleanSelfieText);

  // Definir um limite de similaridade (por exemplo, 0.8)
  const threshold = 0.8;

  return similarity >= threshold;
}

// Função para adicionar marca d'água
async function addWatermark(pdfBuffer, watermarkText) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    page.drawText(watermarkText, {
      x: 50,
      y: page.getHeight() - 50,
      size: 24,
      color: rgb(0.75, 0.75, 0.75),
      opacity: 0.5,
    });
  });

  const modifiedPdfBytes = await pdfDoc.save();
  return modifiedPdfBytes;
}

// Criptografar dados sensíveis
function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-cbc', 'your-secret-key');
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(text) {
  const decipher = crypto.createDecipher('aes-256-cbc', 'your-secret-key');
  let decrypted = decipher.update(text, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Autenticação e autorização
function generateToken(user) {
  return jwt.sign({ userId: user.id, username: user.username }, secretKey, { expiresIn: '1h' });
}

function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send({ success: false, message: 'No token provided' });

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) return res.status(500).send({ success: false, message: 'Failed to authenticate token' });
    req.userId = decoded.userId;
    next();
  });
}

// Configurar logs detalhados
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
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

// Função para converter saldo em Matic
async function convertToMatic(amountInBRL) {
  const maticPriceInBRL = await getMaticPriceInBRL();
  const amountInMatic = amountInBRL / maticPriceInBRL;
  return amountInMatic;
}

// Carteira do administrador
const adminWallet = {
  address: 'ADMIN_WALLET_ADDRESS',
  privateKey: 'ADMIN_WALLET_PRIVATE_KEY',
};

// Função para transferir fundos para a carteira do administrador
async function transferFundsToAdmin(amountInMatic) {
  const tx = web3.eth.sendTransaction({
    from: adminWallet.address,
    to: 'ADMIN_WALLET_ADDRESS',
    value: web3.utils.toWei(amountInMatic, 'ether'),
  });
  return tx;
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

// Endpoint para adicionar saldo conforme o plano adquirido
app.post('/add-balance', verifyToken, async (req, res) => {
  const { plan, userId } = req.body;

  try {
    await addBalanceToUserWallet(userId, plan);
    res.send({ success: true, message: 'Balance added successfully' });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

// Função para processar depósitos em criptomoedas
async function processCryptoDeposit(userId, cryptoAmount, cryptoType) {
  try {
    const response = await axios.post('https://api.bitcart.io/v1/deposit', {
      amount: cryptoAmount,
      currency: cryptoType,
      address: 'YOUR_BITCART_ADDRESS',
      api_key: 'YOUR_BITCART_API_KEY',
    });

    // Adicionar saldo à carteira do usuário
    await pool.query(
      'UPDATE users SET crypto_balance = crypto_balance + $1 WHERE id = $2',
      [cryptoAmount, userId]
    );
  } catch (err) {
    throw new Error('Failed to process crypto deposit');
  }
}

// Endpoint para processar depósitos em criptomoedas
app.post('/process-crypto-deposit', verifyToken, async (req, res) => {
  const { cryptoAmount, cryptoType, userId } = req.body;

  try {
    await processCryptoDeposit(userId, cryptoAmount, cryptoType);
    res.send({ success: true, message: 'Crypto deposit processed successfully' });
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

// Endpoint para registro de documentos com verificação de saldo
app.post('/register-document', verifyToken, async (req, res) => {
  const { documentContent, userId, isPrivate } = req.body;

  // Obter a carteira do usuário do banco de dados
  try {
    const result = await pool.query('SELECT address, private_key FROM users WHERE id = $1', [userId]);
    const userWallet = result.rows[0];

    // Verificar o saldo antes de cada transação
    const gasPrice = 0.0069; // Exemplo: taxa de gas de 0.0069 Matic
    await verifyBalance(userId, gasPrice);

    // Fazer upload do documento para o IPFS
    const ipfsResult = await ipfs.add(documentContent);
    const ipfsHash = ipfsResult.path;

    // Registrar na blockchain usando Web3
    const contractAddress = '0xYourContractAddress'; // Endereço do contrato em Mumbai
    const contractAbi = require('./contractAbi.json'); // ABI do contrato
    const contract = new web3.eth.Contract(contractAbi, contractAddress);

    const documentHash = web3.utils.sha3(ipfsHash);
    const tx = contract.methods.notarize(documentHash, userWallet.address);
    const gas = await tx.estimateGas({ from: userWallet.address });
    const txHash = await tx.send({ from: userWallet.address, gas });

    // Adicionar log de auditoria
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [userId, 'register_document', JSON.stringify({ ipfsHash, txHash })]
    );

    // Adicionar selo e marca d'água ao documento
    const watermarkText = `Selo: ${txHash}\nData: ${new Date().toISOString()}`;
    const signedDocument = await addWatermark(documentContent, watermarkText);

    logger.info(`Document registered by user ${userId}`);
    res.send({ success: true, txHash, documentHash, document: signedDocument });
  } catch (err) {
    logger.error(`Error registering document by user ${userId}: ${err.message}`);
    res.status(500).send({ success: false, error: err.message });
  }
});

// Endpoint para processar pagamentos via Stripe
app.post('/process-payment', verifyToken, async (req, res) => {
  const { amount, paymentMethod, userId } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'brl',
      payment_method: paymentMethod,
      confirmation_method: 'automatic',
      confirm: true,
    });

    // Adicionar saldo ao usuário
    await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [amount / 100, userId]
    );

    res.send({ success: true, paymentIntent });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

// Endpoint de cadastro de usuário com validações e sanitização
app.post('/register-user',
  upload.fields([{ name: 'idPhoto' }, { name: 'selfiePhoto' }]),
  [
    body('username').isString().notEmpty().trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().notEmpty().trim().escape(),
    body('fullName').isString().notEmpty().trim().escape(),
    body('cpf').isString().notEmpty().trim().escape(),
    body('phone').isString().notEmpty().trim().escape(),
    body('address').isString().notEmpty().trim().escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, fullName, cpf, phone, address } = req.body;
    const idPhoto = req.files['idPhoto'][0].path;
    const selfiePhoto = req.files['selfiePhoto'][0].path;

    // Gerar uma nova carteira
    const wallet = generateWallet();

    // Criptografar dados sensíveis
    const encryptedPrivateKey = encrypt(wallet.privateKey);
    const encryptedPassword = encrypt(password);

    // Validar fotos usando OCR
    try {
      const idText = await Tesseract.recognize(idPhoto, 'por');
      const selfieText = await Tesseract.recognize(selfiePhoto, 'por');

      // Comparar textos extraídos (nome e CPF)
      const nameValid = compareTexts(idText.data.text, fullName);
      const cpfValid = cpf ? compareTexts(idText.data.text, cpf) : true;

      if (!nameValid || !cpfValid) {
        return res.status(400).send({ success: false, message: 'Documento inválido' });
      }

      // Armazenar informações do usuário e da carteira no banco de dados
      const result = await pool.query(
        'INSERT INTO users (username, email, password, full_name, cpf, phone, address, address, private_key, public_key, id_photo, selfie_photo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
        [username, email, encryptedPassword, fullName, cpf, phone, address, wallet.address, encryptedPrivateKey, wallet.publicKey, idPhoto, selfiePhoto]
      );
      res.send({ success: true, user: result.rows[0] });
    } catch (err) {
      res.status(500).send({ success: false, error: err.message });
    }
  }
);

// Endpoint de login com validações e sanitização
app.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().notEmpty().trim().escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user || decrypt(user.password) !== password) {
        return res.status(401).send({ success: false, message: 'Invalid email or password' });
      }

      const token = generateToken(user);
      res.send({ success: true, token });
    } catch (err) {
      res.status(500).send({ success: false, error: err.message });
    }
  }
);

app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`);
});
