# ⚡ AtlasNode Agent - Guia Rápido de Auto-Start

## 📋 Resumo

Este guia mostra como instalar o agente AtlasNode com **reinicialização automática** após reboot do sistema.

---

## 🐧 Linux (Método Recomendado)

### 1️⃣ Configure

```bash
cd agent/
cp config.example.json config.json
nano config.json
```

Edite:
- `machineId`: 1 (ou próximo ID disponível)
- `agentToken`: "seu-token-seguro-aqui"
- `controlServer`: "http://IP-DO-SERVIDOR:5000"

### 2️⃣ Instale

```bash
chmod +x install.sh
sudo ./install.sh
```

### 3️⃣ Verifique

```bash
chmod +x status.sh
sudo ./status.sh
```

### ✅ Pronto!

O agente agora:
- ✓ Inicia automaticamente no boot
- ✓ Reinicia automaticamente se falhar
- ✓ Reconecta automaticamente após perda de rede

---

## 🪟 Windows

### 1️⃣ Configure

```cmd
cd agent
copy config.example.json config.json
notepad config.json
```

### 2️⃣ Instale NSSM

Baixe: https://nssm.cc/download

### 3️⃣ Instale o Agente

```cmd
install.bat
```

Siga as instruções na tela.

### 4️⃣ Verifique

```cmd
status.bat
```

---

## 🧪 Teste Rápido

### Verificar se está rodando

**Linux:**
```bash
systemctl status atlasnode-agent
curl http://localhost:7777/health
```

**Windows:**
```cmd
nssm status AtlasNodeAgent
curl http://localhost:7777/health
```

### Teste de reinicialização

```bash
# Linux
sudo systemctl restart atlasnode-agent

# Windows
nssm restart AtlasNodeAgent
```

### Teste de reboot

```bash
# Reinicie a máquina
sudo reboot

# Após reboot, verifique
systemctl status atlasnode-agent
```

---

## 📊 Comandos Úteis

### Linux

```bash
# Iniciar
sudo systemctl start atlasnode-agent

# Parar
sudo systemctl stop atlasnode-agent

# Status
sudo systemctl status atlasnode-agent

# Logs ao vivo
journalctl -u atlasnode-agent -f

# Status completo
sudo ./status.sh
```

### Windows

```cmd
# Iniciar
nssm start AtlasNodeAgent

# Parar
nssm stop AtlasNodeAgent

# Status
nssm status AtlasNodeAgent

# Status completo
status.bat
```

---

## 🛠️ Problemas Comuns

### Não consegue conectar ao servidor

```bash
# Teste conectividade
ping IP-DO-SERVIDOR
curl http://IP-DO-SERVIDOR:5000

# Verifique config.json
cat config.json
```

### Serviço não inicia

**Linux:**
```bash
# Veja os logs
journalctl -u atlasnode-agent -n 50

# Teste manualmente
cd /opt/atlasnode-agent
sudo node agent.js
```

### Firewall bloqueando

**Linux:**
```bash
# Libere a porta 7777
sudo ufw allow 7777
```

---

## 📚 Documentação Completa

- [README-INSTALLATION.md](README-INSTALLATION.md) - Guia detalhado de instalação
- [AUTO-START-SETUP.md](AUTO-START-SETUP.md) - Detalhes sobre auto-start
- [../README.md](../README.md) - Documentação principal do AtlasNode

---

## ✅ Checklist Pós-Instalação

- [ ] Config.json configurado
- [ ] Instalador executado com sucesso
- [ ] Serviço rodando (`status.sh` ou `status.bat`)
- [ ] Auto-start habilitado
- [ ] Health check funcionando (`curl http://localhost:7777/health`)
- [ ] Máquina aparece online no dashboard
- [ ] Teste de reboot realizado

---

**🎉 Instalação completa! Seu agente está protegido contra reinicializações.**

