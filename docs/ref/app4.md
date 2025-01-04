**Passo a Passo para Configurar o Backend Antes de Rodar o Flutter no Frontend**

Com base nas suas preferências e requisitos atualizados, vamos detalhar a configuração do ambiente, utilizando JavaScript/TypeScript com Node.js, Docker, Keycloak e um nó próprio de IPFS, em uma VPS própria da Kyun Host, com Caddy para gerenciar certificados SSL automaticamente.

### **1. Configuração do Ambiente da VPS Kyun Host**

#### **Passo 1.1: Acesso à VPS e Configuração Inicial**

- Acesse a **VPS Kyun Host** usando **SSH**:
  
  ```bash
  ssh root@<seu_ip>
  ```

- **Atualizar Pacotes** e Instalar Docker:
  
  ```bash
  sudo apt update
  sudo apt upgrade -y
  sudo apt install -y docker.io docker-compose
  sudo systemctl start docker
  sudo systemctl enable docker
  ```

#### **Passo 1.2: Instalar Caddy para Gerenciamento de Certificados SSL**

- Instalar o **Caddy**:
  
  ```bash
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo tee /etc/apt/trusted.gpg.d/caddy-stable.asc
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update
  sudo apt install caddy
  ```

- Verificar se o Caddy está instalado:
  
  ```bash
  caddy version
  ```
  
  O Caddy gerenciará automaticamente os certificados SSL por meio de **Let's Encrypt** e oferecerá suporte às conexões seguras HTTPS.

#### **Passo 1.3: Configuração do Docker Compose**

**Arquivo `docker-compose.yml`** atualizado para incluir a configuração do Caddy:

```yaml
version: '3.8'
services:
  backend:
    image: node:16
    container_name: backend
    volumes:
      - ./backend:/usr/src/app
    working_dir: /usr/src/app
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
    command: npm start

  keycloak:
    image: quay.io/keycloak/keycloak:20.0.0
    container_name: keycloak
    environment:
      - KEYCLOAK_USER=admin
      - KEYCLOAK_PASSWORD=admin
      - DB_VENDOR=h2
    ports:
      - "8080:8080"

  ipfs:
    image: ipfs/go-ipfs:latest
    container_name: ipfs
    ports:
      - "5001:5001" # API do IPFS
      - "4001:4001" # Libp2p
      - "8080:8080" # Gateway HTTP do IPFS
    volumes:
      - ipfs_staging:/export
      - ipfs_data:/data/ipfs
    command: ["daemon"]

  caddy:
    image: caddy:latest
    container_name: caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  ipfs_staging:
  ipfs_data:
  caddy_data:
  caddy_config:
```

#### **Passo 1.4: Configuração do Arquivo Caddyfile**

O **Caddyfile** define a configuração do servidor Caddy, especificando domínios e a maneira como o tráfego deve ser roteado.

**Caddyfile**:

```caddyfile
example.com {
    reverse_proxy backend:4000
}

keycloak.example.com {
    reverse_proxy keycloak:8080
}

ipfs.example.com {
    reverse_proxy ipfs:8080
}
```

> Substitua `example.com`, `keycloak.example.com` e `ipfs.example.com` pelos seus domínios reais.

### **2. Desenvolvimento e Configuração do Backend**

#### **Passo 2.1: Backend com Node.js**

Vamos utilizar **Express.js** ou **NestJS**, conforme sua preferência. A seguir, está um exemplo para configuração inicial usando **Express.js**:

- **Bibliotecas Necessárias**:
  - **express**: Para gerenciar requisições HTTP.
  - **web3.js**: Para interagir com a blockchain Polygon.
  - **stripe**: Para integração com a API de pagamentos.
  - **ipfs-http-client**: Para conectar ao nó IPFS e fazer o upload dos arquivos.

**Exemplo de Código para Configuração Inicial do Backend** (`backend/index.js`):

```javascript
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
```

#### **Passo 2.2: Configuração do Stripe para Pagamentos**

- Configure uma rota no backend que será usada para criar sessões de pagamento no Stripe.

**Exemplo de Código para Rota de Pagamento**:

```javascript
app.post('/create-payment', async (req, res) => {
  const { amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Valor em centavos
      currency: 'usd',
      payment_method_types: ['card'],
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});
```

### **3. Keycloak e Gerenciamento de Identidade**

#### **Passo 3.1: Configurar Keycloak**

- Acesse **Keycloak** na URL `http://localhost:8080`.
- **Criar um Realm**: Crie um novo realm para gerenciar seus usuários.
- **Criar um Cliente**: Crie um cliente para sua aplicação Flutter e defina as configurações de **OIDC (OpenID Connect)**.
- **Gerenciar Usuários**: Crie grupos de usuários que se diferenciem por tipo de plano (assinatura mensal, compra única, etc.).

### **4. Rede Blockchain Polygon (Mumbai Testnet)**

#### **Passo 4.1: Conectar ao Polygon (Mumbai)**

- Configure o Web3 no backend para se conectar à **Mumbai Testnet** utilizando **Alchemy** ou **Infura**.

#### **Passo 4.2: Configuração do Contrato Inteligente**

- **Deploy do Contrato**:
  - Faça o deploy do contrato em Mumbai usando **Remix** ou **Truffle**.
  - Atualize o endereço do contrato no backend para refletir o endereço de deploy em **Mumbai**.

#### **Passo 4.3: Gestão de Carteiras de Usuário**

- **Gerar e Gerenciar Chaves**:
  - Crie carteiras de custódia para cada usuário no backend.
  - Utilize a biblioteca **ethers.js** ou **web3.js** para gerar chaves.
  - **Armazenar Chaves com Segurança**: Utilize **Vault** ou HSM para armazenar chaves de forma segura.

### **5. Armazenamento IPFS com Nó Próprio**

#### **Passo 5.1: Rodar um Nó IPFS no Docker**

- O nó IPFS já está sendo executado em um container Docker.

- **Testar Conexão**:
  
  ```bash
  curl http://localhost:5001/api/v0/id
  ```
  
  Esse comando deve retornar detalhes do nó, confirmando que ele está rodando corretamente.

### **Conclusão e Resumo**

- **Ambiente da VPS**: Configuramos o ambiente com Docker, Keycloak, IPFS, e Caddy.
- **Backend**: Desenvolver o backend com **Node.js** para gerenciar todas as interações (blockchain, IPFS, pagamentos).
- **Docker Compose**: Configurar e rodar containers para backend, Keycloak, IPFS e Caddy.
- **Blockchain Polygon**: Conectar à **Mumbai Testnet** usando **Alchemy** ou **Infura**.
- **Keycloak para Identidade**: Configurar um realm para autenticação centralizada.
- **Pagamentos**: Usar **Stripe** para compra de créditos.
- **Armazenamento IPFS**: Rodar um nó IPFS localmente para armazenamento descentralizado.

Os próximos passos envolvem **testar a integração completa localmente** e, em seguida, realizar o **deploy em produção**. Caso precise de mais ajuda ou queira otimizar algum ponto, estarei à disposição para seguir com as próximas etapas.
