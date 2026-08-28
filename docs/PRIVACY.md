# Política de Privacidade — Protocolo PEP

**Última atualização:** Agosto de 2026

## 1. Princípio Fundamental
O **Protocolo PEP** foi concebido sob a filosofia **Local-First** e de máxima privacidade de dados. Acreditamos que informações de saúde e rotinas de aplicação pertencem única e exclusivamente a você.

---

## 2. Coleta e Tratamento de Dados
- **Zero Coleta em Nuvem:** O aplicativo **não** coleta, transmite, armazena ou processa seus dados pessoais ou registros em nenhum servidor remoto.
- **Armazenamento Local:** Todos os dados (nome dos peptídeos, horários, doses, registros de histórico e preferências de tema) são salvos exclusivamente no armazenamento local do seu dispositivo Android (`localStorage` no WebView e armazenamento seguro do Capacitor).
- **Sem Rastreamento ou Anúncios:** O aplicativo não contém bibliotecas de analytics invasivas, rastreadores comportamentais ou redes de anúncios.

---

## 3. Permissões Solicitadas no Android
- `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`: Necessárias exclusivamente para que o sistema operacional Android dispare os lembretes sonoros/vibratórios no horário exato configurado pelo usuário, mesmo se o aplicativo estiver em segundo plano.
- `POST_NOTIFICATIONS`: Necessária no Android 13+ para exibir os avisos visuais de lembrete de dose na barra de notificações.

---

## 4. Backup e Exportação
- O aplicativo permite exportar um arquivo `.json` contendo seus registros para que você possa fazer cópias de segurança manuais ou migrar de dispositivo.
- Esse arquivo fica sob seu controle no armazenamento de arquivos do seu celular e nunca é transmitido automaticamente para a nuvem.

---

## 5. Exclusão de Dados
- Você pode apagar todos os registros, históricos e protocolos a qualquer momento diretamente nas configurações do aplicativo ou limpando os dados do aplicativo nas Configurações do Android.
