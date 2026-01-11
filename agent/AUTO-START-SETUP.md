# 🚀 Configuração de Auto-Start do AtlasNode Agent

## ✅ O Que Foi Implementado

Este sistema garante que o agente AtlasNode **sempre reinicie automaticamente** após um reboot do sistema, evitando perda de conexão.

### 📦 Arquivos Criados

```
agent/
├── atlasnode-agent.service    # Serviço systemd (Linux)
├── install.sh                 # Instalador automático (Linux)
├── uninstall.sh               # Desinstalador (Linux)
├── install.bat                # Instalador (Windows)
├── status.sh                  # Verificador de status (Linux)
├── status.bat                 # Verificador de status (Windows)
├── README-INSTALLATION.md     # Guia completo de instalação
└── AUTO-START-SETUP.md        # Este arquivo (resumo)
```

## 🐧 Instalação Rápida - Linux (Recomendado)

### Passo 1: Configure o config.json

```bash
cd agent/
cp config.example.json config.json
nano config.json
```

Edite:
- `machineId`: ID único (ex: 1, 2, 3...)
- `agentToken`: Token seguro (ex: "abc123xyz...")
- `controlServer`: URL do servidor (ex: "http://192.168.1.100:5000")

### Passo 2: Execute o instalador

```bash
sudo chmod +x install.sh
sudo ./install.sh
```

✨ **Pronto!** O agente agora:
- ✓ Inicia automaticamente no boot
- ✓ Reinicia automaticamente se falhar
- ✓ Aguarda a rede estar disponível
- ✓ Registra logs no systemd journal

### Passo 3: Verifique o status

```bash
sudo chmod +x status.sh
sudo ./status.sh
```

## 🪟 Instalação Rápida - Windows

### Passo 1: Configure o config.json

```cmd
cd agent
copy config.example.json config.json
notepad config.json
```

### Passo 2: Instale o NSSM

1. Baixe: https://nssm.cc/download
2. Extraia e adicione ao PATH

### Passo 3: Execute o instalador

```cmd
install.bat
```

Siga as instruções na tela para configurar o serviço Windows.

## 🔍 Verificando se o Auto-Start Está Funcionando

### Linux

```bash
# Método 1: Use o script de status
sudo ./status.sh

# Método 2: Comandos manuais
systemctl is-enabled atlasnode-agent    # Deve retornar "enabled"
systemctl is-active atlasnode-agent     # Deve retornar "active"
systemctl status atlasnode-agent        # Mostra status detalhado
```

### Windows

```cmd
# Método 1: Use o script de status
status.bat

# Método 2: Verificar serviço
sc query AtlasNodeAgent
nssm status AtlasNodeAgent
```

## 🔄 Comportamento de Reinicialização

### Quando o agente reinicia automaticamente?

1. **No boot do sistema** - Inicia automaticamente
2. **Após falha/crash** - Reinicia após 10 segundos
3. **Após reboot manual** - Reinicia no próximo boot
4. **Após perda de rede** - Continua tentando se reconectar

### Configurações de Reinicialização (Linux/systemd)

```ini
Restart=always              # Sempre reinicia
RestartSec=10              # Aguarda 10s antes de reiniciar
StartLimitBurst=3          # Tenta até 3x em 60s
After=network-online.target # Aguarda a rede
```

## 📊 Monitoramento e Logs

### Linux

```bash
# Ver logs em tempo real
journalctl -u atlasnode-agent -f

# Ver últimas 50 linhas
journalctl -u atlasnode-agent -n 50

# Ver logs desde o último boot
journalctl -u atlasnode-agent -b

# Ver logs com timestamp
journalctl -u atlasnode-agent --since "10 minutes ago"
```

### Windows

```cmd
# Ver log de eventos
eventvwr.msc

# Ou use NSSM para ver logs
nssm status AtlasNodeAgent
```

## 🧪 Testando o Auto-Start

### Teste 1: Reiniciar o Serviço

**Linux:**
```bash
sudo systemctl restart atlasnode-agent
sudo systemctl status atlasnode-agent
```

**Windows:**
```cmd
nssm restart AtlasNodeAgent
nssm status AtlasNodeAgent
```

### Teste 2: Simular Crash

**Linux:**
```bash
# Mate o processo
sudo pkill -9 node

# Aguarde 10 segundos e verifique
sleep 10
sudo systemctl status atlasnode-agent
# Deve estar rodando novamente!
```

### Teste 3: Reboot Completo

```bash
# Anote o uptime atual do agente
curl http://localhost:7777/health

# Reinicie a máquina
sudo reboot

# Após o reboot, verifique se o agente está rodando
sudo systemctl status atlasnode-agent
curl http://localhost:7777/health
```

## ⚙️ Comandos Úteis

### Linux (systemd)

| Comando | Descrição |
|---------|-----------|
| `sudo systemctl start atlasnode-agent` | Iniciar serviço |
| `sudo systemctl stop atlasnode-agent` | Parar serviço |
| `sudo systemctl restart atlasnode-agent` | Reiniciar serviço |
| `sudo systemctl status atlasnode-agent` | Ver status |
| `sudo systemctl enable atlasnode-agent` | Habilitar auto-start |
| `sudo systemctl disable atlasnode-agent` | Desabilitar auto-start |
| `journalctl -u atlasnode-agent -f` | Ver logs ao vivo |
| `sudo ./status.sh` | Status completo |

### Windows (NSSM)

| Comando | Descrição |
|---------|-----------|
| `nssm start AtlasNodeAgent` | Iniciar serviço |
| `nssm stop AtlasNodeAgent` | Parar serviço |
| `nssm restart AtlasNodeAgent` | Reiniciar serviço |
| `nssm status AtlasNodeAgent` | Ver status |
| `nssm install AtlasNodeAgent [...]` | Instalar serviço |
| `nssm remove AtlasNodeAgent` | Remover serviço |
| `status.bat` | Status completo |

## 🗑️ Desinstalação

### Linux

```bash
sudo chmod +x uninstall.sh
sudo ./uninstall.sh
```

### Windows

```cmd
nssm stop AtlasNodeAgent
nssm remove AtlasNodeAgent confirm
```

## 🛠️ Solução de Problemas

### Problema: Serviço não inicia após reboot

**Linux:**
```bash
# Verifique o status
sudo systemctl status atlasnode-agent

# Verifique se está habilitado
systemctl is-enabled atlasnode-agent

# Se não estiver, habilite
sudo systemctl enable atlasnode-agent

# Verifique os logs
journalctl -u atlasnode-agent -n 100
```

### Problema: Erro "Cannot reach control server"

**Soluções:**
1. Verifique se o `controlServer` no `config.json` está correto
2. Teste a conectividade: `curl http://seu-servidor:5000/api/health`
3. Verifique o firewall: `sudo ufw status`
4. Verifique se o servidor de controle está rodando

### Problema: Agente reinicia em loop

**Causa comum:** config.json inválido ou servidor inacessível

**Solução:**
```bash
# Pare o serviço temporariamente
sudo systemctl stop atlasnode-agent

# Verifique o config.json
cat /opt/atlasnode-agent/config.json

# Teste manualmente
cd /opt/atlasnode-agent
node agent.js

# Se funcionar, reinicie o serviço
sudo systemctl start atlasnode-agent
```

## 🔒 Segurança

### Permissões dos Arquivos

**Linux:**
```bash
# Permissões recomendadas
sudo chown -R root:root /opt/atlasnode-agent/
sudo chmod 755 /opt/atlasnode-agent/
sudo chmod 600 /opt/atlasnode-agent/config.json
```

### Firewall

**Linux (ufw):**
```bash
# Permitir apenas do servidor de controle
sudo ufw allow from 192.168.1.100 to any port 7777
```

**Linux (iptables):**
```bash
# Permitir apenas do servidor de controle
sudo iptables -A INPUT -p tcp -s 192.168.1.100 --dport 7777 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 7777 -j DROP
```

## 📈 Métricas de Monitoramento

O agente envia dados regularmente:

- **Heartbeat**: A cada 60 segundos (configurável)
- **Discovery (portas/screens)**: A cada 30 segundos
- **Registro inicial**: Na primeira inicialização

### Verificar Conectividade

```bash
# Health check local
curl http://localhost:7777/health

# Ver se está enviando heartbeat
journalctl -u atlasnode-agent -f | grep "Heartbeat sent"

# Ver se está enviando discovery
journalctl -u atlasnode-agent -f | grep "Discovery"
```

## 📝 Configuração Avançada

### Alterar Intervalo de Heartbeat

Edite `/opt/atlasnode-agent/config.json`:

```json
{
  "heartbeatInterval": 30000
}
```

Valores em milissegundos:
- 30000 = 30 segundos
- 60000 = 1 minuto (padrão)
- 120000 = 2 minutos

Após editar, reinicie:
```bash
sudo systemctl restart atlasnode-agent
```

### Executar como Usuário Não-Root (Linux)

⚠️ **Aviso:** Algumas funcionalidades podem não funcionar sem privilégios root.

1. Crie um usuário dedicado:
```bash
sudo useradd -r -s /bin/false atlasnode
```

2. Edite o serviço:
```bash
sudo nano /etc/systemd/system/atlasnode-agent.service
```

3. Altere a linha `User=root` para `User=atlasnode`

4. Ajuste permissões:
```bash
sudo chown -R atlasnode:atlasnode /opt/atlasnode-agent/
```

5. Recarregue e reinicie:
```bash
sudo systemctl daemon-reload
sudo systemctl restart atlasnode-agent
```

## ✅ Checklist Pós-Instalação

- [ ] Agente instalado e rodando
- [ ] Auto-start habilitado
- [ ] Config.json configurado corretamente
- [ ] Conectividade com servidor de controle testada
- [ ] Logs verificados sem erros
- [ ] Teste de reboot realizado
- [ ] Firewall configurado (se necessário)
- [ ] Máquina aparece online no dashboard

## 🎉 Conclusão

Seu agente AtlasNode está agora configurado para **sempre reiniciar automaticamente**!

Em caso de:
- ✅ Reboot do sistema → Agente inicia automaticamente
- ✅ Falha/crash → Agente reinicia em 10 segundos
- ✅ Perda de rede → Agente continua tentando reconectar
- ✅ Atualização do sistema → Agente volta após reboot

Para suporte adicional, consulte:
- [README-INSTALLATION.md](README-INSTALLATION.md) - Guia detalhado
- [README.md](../README.md) - Documentação principal

---

**Desenvolvido para AtlasNode** - Sistema de Gerenciamento de Homelab

