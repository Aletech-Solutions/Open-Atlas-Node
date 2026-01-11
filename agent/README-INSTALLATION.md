# AtlasNode Agent - Guia de Instalação

Este guia explica como instalar o AtlasNode Agent para que ele inicie automaticamente após o reboot do sistema.

## 📋 Pré-requisitos

- **Node.js** v14 ou superior
- **Acesso root/administrador** ao sistema
- Arquivo `config.json` configurado

## 🐧 Instalação no Linux (Recomendado)

O agente usa systemd para inicialização automática no Linux.

### 1. Configure o arquivo config.json

```bash
cd agent/
cp config.example.json config.json
nano config.json  # ou vim, ou seu editor preferido
```

Edite as seguintes configurações:
- `controlServer`: URL do servidor de controle
- `machineId`: ID único da máquina
- `agentToken`: Token de autenticação
- `port`: Porta para o agente (padrão: 7777)

### 2. Execute o script de instalação

```bash
sudo chmod +x install.sh
sudo ./install.sh
```

O script irá:
- ✓ Verificar dependências
- ✓ Copiar arquivos para `/opt/atlasnode-agent`
- ✓ Instalar dependências do Node.js
- ✓ Criar e habilitar o serviço systemd
- ✓ Iniciar o agente automaticamente

### 3. Verifique o status

```bash
sudo systemctl status atlasnode-agent
```

### 4. Visualize os logs

```bash
# Logs em tempo real
sudo journalctl -u atlasnode-agent -f

# Últimas 50 linhas
sudo journalctl -u atlasnode-agent -n 50
```

## 🔧 Comandos Úteis (Linux)

```bash
# Iniciar o serviço
sudo systemctl start atlasnode-agent

# Parar o serviço
sudo systemctl stop atlasnode-agent

# Reiniciar o serviço
sudo systemctl restart atlasnode-agent

# Ver status
sudo systemctl status atlasnode-agent

# Desabilitar inicialização automática
sudo systemctl disable atlasnode-agent

# Habilitar inicialização automática
sudo systemctl enable atlasnode-agent

# Ver logs
sudo journalctl -u atlasnode-agent -f
```

## 🗑️ Desinstalação (Linux)

```bash
cd agent/
sudo chmod +x uninstall.sh
sudo ./uninstall.sh
```

## 🪟 Instalação no Windows

### Opção 1: Usando NSSM (Recomendado)

1. **Baixe o NSSM** (Non-Sucking Service Manager)
   - https://nssm.cc/download
   - Extraia e adicione ao PATH do sistema

2. **Configure o config.json**
   ```cmd
   cd agent
   copy config.example.json config.json
   notepad config.json
   ```

3. **Execute o instalador** (como Administrador)
   ```cmd
   install.bat
   ```

4. **Instale o serviço com NSSM**
   ```cmd
   cd agent
   nssm install AtlasNodeAgent "C:\Program Files\nodejs\node.exe" "%CD%\agent.js"
   nssm set AtlasNodeAgent AppDirectory "%CD%"
   nssm set AtlasNodeAgent DisplayName "AtlasNode Agent"
   nssm set AtlasNodeAgent Description "AtlasNode System Monitor and Control Agent"
   nssm set AtlasNodeAgent Start SERVICE_AUTO_START
   nssm set AtlasNodeAgent AppExit Default Restart
   nssm set AtlasNodeAgent AppRestartDelay 10000
   nssm start AtlasNodeAgent
   ```

### Opção 2: Usando Agendador de Tarefas do Windows

1. Abra o **Agendador de Tarefas** (Task Scheduler)
2. Clique em **Criar Tarefa Básica**
3. Configure:
   - **Nome**: AtlasNode Agent
   - **Gatilho**: Ao iniciar o computador
   - **Ação**: Iniciar um programa
   - **Programa**: `C:\caminho\para\agent\start-agent.bat`
   - Marque: **Executar com privilégios mais altos**

## 🔄 Comportamento de Reinicialização

O serviço está configurado para:

### Linux (systemd)
- **Restart=always**: Reinicia sempre que o processo termina
- **RestartSec=10**: Aguarda 10 segundos antes de reiniciar
- **StartLimitBurst=3**: Tenta reiniciar até 3 vezes em 60 segundos
- **After=network-online.target**: Aguarda a rede estar disponível
- **WantedBy=multi-user.target**: Inicia no boot do sistema

### Windows (NSSM)
- **SERVICE_AUTO_START**: Inicia automaticamente com o Windows
- **AppExit Default Restart**: Reinicia em caso de falha
- **AppRestartDelay 10000**: Aguarda 10 segundos antes de reiniciar

## 📊 Verificando se o Auto-Start está Funcionando

### Linux
```bash
# Verifica se o serviço está habilitado
systemctl is-enabled atlasnode-agent

# Deve retornar: enabled
```

### Windows
```cmd
# Usando NSSM
nssm status AtlasNodeAgent

# Ou verifique o serviço
sc query AtlasNodeAgent
```

## 🐛 Solução de Problemas

### O serviço não inicia após reboot

**Linux:**
```bash
# Verifique o status
sudo systemctl status atlasnode-agent

# Verifique os logs
sudo journalctl -u atlasnode-agent -n 100

# Verifique se está habilitado
systemctl is-enabled atlasnode-agent
```

**Windows:**
```cmd
# Verifique o log de eventos do Windows
eventvwr.msc
```

### Erro: "Cannot reach control server"

Verifique se:
- O `controlServer` no `config.json` está correto
- A máquina tem acesso à internet/rede
- O servidor de controle está rodando
- O firewall não está bloqueando a conexão

### Erro de permissões

**Linux:**
```bash
# Verifique as permissões dos arquivos
ls -la /opt/atlasnode-agent/

# Ajuste se necessário
sudo chown -R root:root /opt/atlasnode-agent/
sudo chmod -R 755 /opt/atlasnode-agent/
```

## 🔒 Considerações de Segurança

- O agente roda como **root** no Linux para acesso completo ao sistema
- Proteja o `agentToken` no `config.json`
- Use HTTPS no `controlServer` em produção
- Configure firewall para permitir apenas IPs autorizados na porta do agente

## 📝 Notas Adicionais

- O agente envia heartbeat a cada 60 segundos (configurável)
- Discovery de portas/screens a cada 30 segundos
- Logs são armazenados via journald (Linux) ou Event Viewer (Windows)
- O serviço aguarda a rede estar disponível antes de iniciar

## 🆘 Suporte

Para problemas ou dúvidas:
1. Verifique os logs primeiro
2. Consulte a documentação principal
3. Abra uma issue no repositório GitHub

