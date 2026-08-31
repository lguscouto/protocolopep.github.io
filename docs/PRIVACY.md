# Política de Privacidade — Protocolo PEP

**Última atualização:** Agosto de 2026

## 1. Princípio Fundamental
O **Protocolo PEP** foi concebido sob a filosofia **Local-First** e de máxima privacidade de dados. Acreditamos que informações de saúde, rotinas de aplicação e registros corporais pertencem única e exclusivamente a você.

---

## 2. Coleta e Tratamento de Dados
- **Zero Coleta em Nuvem:** O aplicativo **não** coleta, transmite, armazena ou processa seus dados pessoais ou registros em nenhum servidor remoto ou serviço de nuvem.
- **Armazenamento 100% Local:** Todos os dados (nome dos peptídeos, horários, doses, registros de histórico de aplicação, estoque de frascos, locais de injeção, medições de peso e preferências de interface) são salvos exclusivamente no armazenamento local do seu dispositivo (`localStorage` protegido no WebView e armazenamento isolado de app no Android).
- **Sem Rastreamento, Telemetria ou Anúncios:** O aplicativo não contém bibliotecas de analytics invasivas, identificadores de publicidade, rastreadores comportamentais ou anúncios.

---

## 3. Integração com Android Health Connect
O Protocolo PEP oferece integração opcional com o **Health Connect (Android)** para leitura e escrita de registros de peso corporal:
- **Dados Acessados:** Leitura e registro de **Peso Corporal (kg)** e respectivos carimbos de data/hora (`Instant` e `ZoneOffset`).
- **Finalidade:** Permitir que o usuário acompanhe a evolução do peso corporal em conjunto com sua rotina de peptídeos e sincronize medições com o repositório de saúde nativo do sistema operacional.
- **Controle do Usuário:** A sincronização com o Health Connect é estritamente **opt-in** (desativada por padrão) e exige permissão explícita através da interface nativa do Android.
- **Revogação de Permissões:** Você pode revogar as permissões de leitura ou escrita a qualquer momento nas configurações do Health Connect no Android (`Configurações > Segurança e Privacidade > Health Connect > Protocolo PEP`).
- **Não Compartilhamento:** Nenhum dado lido do Health Connect é transmitido para terceiros ou servidores externos.

---

## 4. Permissões Solicitadas no Android
- `SCHEDULE_EXACT_ALARM`: Necessária para agendar e disparar lembretes sonoros e vibratórios nos horários exatos configurados pelo usuário, respeitando os modos de economia de bateria.
- `POST_NOTIFICATIONS`: Necessária no Android 13+ (API 33+) para exibir os avisos visuais de lembrete de dose na barra de notificações.
- `android.permission.health.READ_WEIGHT` e `android.permission.health.WRITE_WEIGHT`: Necessárias exclusivamente quando o usuário opta por sincronizar medições de peso com o Health Connect.
- `USE_BIOMETRIC`: Utilizada opcionalmente no Bloqueio por Biometria/PIN local para proteger o acesso visual ao aplicativo. A autenticação é processada pelo hardware de segurança do próprio sistema operacional (Keystore/BiometricPrompt) sem retenção de dados biométricos pelo app.

---

## 5. Backup e Exportação
- O aplicativo permite exportar um arquivo `.json` contendo seus registros para que você possa fazer cópias de segurança manuais ou migrar de dispositivo.
- Esse arquivo fica sob seu controle no armazenamento de arquivos do seu celular e nunca é transmitido automaticamente para a internet.

---

## 6. Exclusão de Dados
- Você pode apagar todos os registros, históricos e protocolos a qualquer momento diretamente na aba **Ajustes > Limpar Dados** do aplicativo ou limpando os dados do aplicativo nas Configurações do Android.

