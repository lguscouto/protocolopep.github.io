# Política de Privacidade — Protocolo PEP

**Última atualização:** 2 de Setembro de 2026  
**Versão da Aplicação:** 2.9.0

## 1. Princípio Fundamental e Arquitetura Local-First
O **Protocolo PEP** foi concebido e estruturado sob os princípios **Local-First**, **Privacidade por Padrão** e **Não Rastreamento**. Acreditamos que seus dados médicos, protocolos de peptídeos, horários de aplicação, notas de reconstituição e medições corporais pertencem única e exclusivamente a você.

---

## 2. Coleta e Tratamento de Dados
- **Zero Coleta em Servidores Remotos:** O Protocolo PEP **não** transmite, armazena ou processa seus dados pessoais em servidores em nuvem, bancos de dados externos ou APIs remotas de terceiros.
- **Armazenamento Local:** Os dados principais do Protocolo PEP (protocolos cadastrados, histórico de doses, controle de estoque de frascos, mapa de sítios de injeção, medições de peso/sintomas e preferências de interface) permanecem no armazenamento local protegido e isolado da aplicação no seu dispositivo (`localStorage` encapsulado e sandbox de dados do Android). Quando o usuário habilita expressamente o Health Connect, medições de peso autorizadas também podem ser lidas e/ou gravadas no repositório Health Connect do Android.
- **Sem Rastreamento, Telemetria ou Anúncios:** A aplicação é totalmente livre de identificadores de publicidade (Ad-ID), SDKs de telemetria invasiva ou anúncios comerciais.

---

## 3. Integração com Android Health Connect
O Protocolo PEP inclui suporte opcional e transparente à API nativa do **Health Connect (Android)**:
- **Dados Acessados:**
  - **Leitura:** Leitura estrita de registros de **Peso Corporal (`WeightRecord`)** em quilogramas (kg) e respectivos carimbos temporais (`Instant` e `ZoneOffset`).
  - **Escrita:** Gravação das medições de **Peso Corporal (`WeightRecord`)** inseridas manualmente pelo usuário no aplicativo.
- **Finalidade:** Permitir a visualização consolidada da evolução do peso corporal em conjunto com o acompanhamento da rotina de peptídeos, sincronizando com o ecossistema de saúde nativo do sistema operacional.
- **Controle do Usuário e Consentimento Explícito:** A sincronização com o Health Connect é estritamente **opt-in** (desativada por padrão). O aplicativo solicita permissão explícita por meio da interface oficial do sistema operacional Android.
- **Isolamento de Origem (`dataOrigin`):** O aplicativo identifica estritamente a origem dos registros. Medições de outras fontes (ex: balanças inteligentes ou apps terceiros) não são reivindicadas nem alteradas pelo Protocolo PEP.
- **Revogação e Exclusão:** Você pode revogar as permissões de leitura e gravação a qualquer momento em `Configurações > Segurança e Privacidade > Health Connect > Protocolo PEP`. Ao desativar ou limpar os dados no app, os vínculos locais são integralmente removidos.
- **Não Compartilhamento:** Nenhum dado lido ou processado a partir do Health Connect é transmitido para terceiros, intermediários ou redes externas.

---

## 4. Permissões Solicitadas no Android
- `SCHEDULE_EXACT_ALARM`: Utilizada para disparar alarmes e lembretes sonoros/vibratórios nos horários exatos programados para cada composto, garantindo que o usuário não perca a janela de aplicação mesmo com otimizações de economia de bateria (Doze Mode).
- `POST_NOTIFICATIONS`: Utilizada no Android 13+ (API 33+) para a exibição dos avisos visuais de lembrete de dose na barra de status.
- `android.permission.health.READ_WEIGHT` e `android.permission.health.WRITE_WEIGHT`: Utilizadas unicamente quando o usuário opta expressamente por conectar o aplicativo ao Health Connect.
- `USE_BIOMETRIC` / `USE_FINGERPRINT`: Utilizada de forma opcional no Bloqueio por Biometria/PIN local para restringir o acesso à interface do app. A autenticação é realizada diretamente pelo hardware seguro do Android (BiometricPrompt / KeyStore), sem acesso ou retenção de dados biométricos pela aplicação.

---

## 5. Cópia de Segurança e Portabilidade (Backup Local)
- O aplicativo disponibiliza ferramenta de exportação em formato `.json` para que você possa gerar cópias de segurança locais e restaurá-las quando desejar.
- O arquivo exportado é salvo diretamente no armazenamento do seu dispositivo e nunca é enviado automaticamente para a internet.

---

## 6. Exclusão Total de Dados
- Você tem autonomia completa para apagar todos os dados, históricos e configurações a qualquer momento em **Ajustes > Limpar Dados** ou através da limpeza de dados do aplicativo no menu de configurações do Android.
