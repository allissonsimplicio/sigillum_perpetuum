### Separando os Serviços em Pastas e Arquivos Docker Compose

Vou dividir o projeto em diferentes pastas, uma para cada serviço, e criar um `docker-compose.yml` para cada um deles. Dessa forma, podemos manter a configuração organizada e modular. Vou também adicionar o Flutter ao projeto. Se preferir usar Docker para o Flutter, facilitaremos o processo para testes e desenvolvimento de maneira consistente.

#### Estrutura de Diretórios Proposta

```
- projeto
  - backend
    - docker-compose.yml
    - Dockerfile
  - keycloak
    - docker-compose.yml
  - ipfs
    - docker-compose.yml
  - caddy
    - Caddyfile
    - docker-compose.yml
  - compreface
    - docker-compose.yml
  - tesseract
    - docker-compose.yml
  - flutter
    - docker-compose.yml
    - Dockerfile
```

Cada pasta contém um `docker-compose.yml` próprio e, onde necessário, um `Dockerfile`. Vou detalhar cada serviço e como configurá-los.

#### **1. Backend (Node.js)**

**backend/docker-compose.yml**

```yaml
docker-compose.yml:
version: '3.8'
services:
  backend:
    build: .
    container_name: backend
    volumes:
      - ./src:/usr/src/app
      - backend_data:/data
    working_dir: /usr/src/app
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
    command: npm start

volumes:
  backend_data:
```

**backend/Dockerfile**

```dockerfile
FROM node:16
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

#### **2. Keycloak**

**keycloak/docker-compose.yml**

```yaml
version: '3.8'
services:
  keycloak:
    image: quay.io/keycloak/keycloak:20.0.0
    container_name: keycloak
    environment:
      - KEYCLOAK_USER=admin
      - KEYCLOAK_PASSWORD=admin
      - DB_VENDOR=h2
    ports:
      - "8080:8080"
    volumes:
      - keycloak_data:/opt/keycloak/data

volumes:
  keycloak_data:
```

#### **3. IPFS**

**ipfs/docker-compose.yml**

```yaml
version: '3.8'
services:
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

volumes:
  ipfs_staging:
  ipfs_data:
```

#### **4. Caddy**

**caddy/docker-compose.yml**

```yaml
version: '3.8'
services:
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
  caddy_data:
  caddy_config:
```

**caddy/Caddyfile**

```caddyfile
example.com {
    reverse_proxy flutter:8081
}

api.example.com {
    reverse_proxy backend:4000
}

keycloak.example.com {
    reverse_proxy keycloak:8080
}

ipfs.example.com {
    reverse_proxy ipfs:8080
}
```

#### **5. CompreFace**

**compreface/docker-compose.yml**

```yaml
version: '3.8'
services:
  compreface:
    image: exadel/compreface
    container_name: compreface
    ports:
      - "80:80"
    volumes:
      - compreface_data:/data

volumes:
  compreface_data:
```

#### **6. Tesseract OCR**

**tesseract/docker-compose.yml**

```yaml
version: '3.8'
services:
  tesseract:
    image: tesseractshadow/tesseract4re
    container_name: tesseract_ocr
    volumes:
      - ./data:/data
    command: ""

volumes:
  tesseract_data:
```

#### **7. Flutter**

Podemos rodar o Flutter em Docker para padronizar o ambiente, principalmente útil para desenvolvimento em equipe ou para facilitar a replicação em diferentes máquinas. Abaixo segue a configuração.

**flutter/docker-compose.yml**

```yaml
version: '3.8'
services:
  flutter:
    build: .
    container_name: flutter
    ports:
      - "8081:8081"
    volumes:
      - ./app:/usr/src/app
      - flutter_data:/data
    working_dir: /usr/src/app
    command: flutter run -d web-server --web-port 8081

volumes:
  flutter_data:
```

**flutter/Dockerfile**

```dockerfile
FROM cirrusci/flutter:latest
WORKDIR /usr/src/app
COPY . .
CMD ["flutter", "run", "-d", "web-server", "--web-port", "8081"]
```

### **Executando o Projeto Completo**

1. Navegue até cada pasta individual e execute o comando para levantar cada serviço.
   
   ```bash
   docker-compose up -d
   ```
   
   Você pode fazer isso em cada um dos diretórios: `backend/`, `keycloak/`, `ipfs/`, `caddy/`, `compreface/`, `tesseract/`, e `flutter/`.

2. Certifique-se de que todos os serviços estão funcionando verificando os logs.
   
   ```bash
   docker-compose logs -f
   ```

### **Resumo**

- **Modularização**: Cada serviço é separado, o que facilita a manutenção e atualização individual.
- **Caddy**: Gerencia o SSL automaticamente para todos os subdomínios definidos no Caddyfile.
- **Docker para Flutter**: Facilita o desenvolvimento padronizado.
- **Volumes Adicionados**: Volumes persistentes foram adicionados a todos os serviços para garantir que os dados sejam preservados em caso de reinicialização dos containers ou mudanças de configuração.

Se precisar de mais alguma customização ou detalhes adicionais, estou aqui para ajudar!
