# 🧪 Protocolo PEP · App Android (Local-First)

![Version](https://img.shields.io/badge/version-2.6.0-2CC5C0)
![Android](https://img.shields.io/badge/Android-8.0%2B-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://github.com/lguscouto/protocolopep.github.io/actions/workflows/ci.yml/badge.svg)

Aplicativo Android nativo para acompanhamento de protocolos de peptídeos, cálculo de reconstituição e registro diário de doses, construído com arquitetura **100% Local-First**, segurança matemática auditável e suporte aos **temas Branco e Preto OLED**.

---

## 🚀 Novidades da Versão 2.6.0 (DialogService Acessível, Modularização da Calculadora, Ownership Estrito e Auditoria WCAG 2.1 AA)

- **Centralização de Diálogos & Acessibilidade (`DialogService`):**
  - Implementação do `DialogService` centralizado (`src/services/dialog.js`) com `confirm()` e `alert()` assíncronos.
  - Eliminação completa de chamadas síncronas bloqueantes `alert()` e `confirm()` nativas em todo o código.
  - Suporte completo a navegação por teclado com focus trap (`Tab`/`Shift+Tab`), cancelamento e fechamento via tecla `Escape`, retorno de foco ao elemento disparador e haptics integrados.
- **Separação Semântica de Timestamps & Migração V4→V5 (P0):**
  - Desacoplamento estrito de `timestamp` (instante do fato clínico) e `createdAt` (instante de criação do registro no banco local), além da inclusão de `updatedAt`.
  - Pipeline sequencial de migrações automáticas `migrateV4ToV5` com backfill seguro.
- **Sincronização Estrita Health Connect & Proteção de Registros Externos (P1):**
  - Decisões de exportação e emissão de tombstones baseadas exclusivamente no campo `ownership === "pep"`.
  - Janela de sincronização de leitura calibrada para 30 dias no JavaScript e Kotlin (`PepHealthConnectPlugin.kt`).
  - Proteção de dados importados do Health Connect: campos corporais externos em modo somente leitura e ação de exclusão convertida para ocultação local ("Ocultar no PEP") com persistência em `hiddenMeasurementIds`.
  - Fluxo de autorização de `SCHEDULE_EXACT_ALARM` no Android com prompt acessível.
- **Modularização da Calculadora de Reconstituição (P2):**
  - Desacoplamento da interface da calculadora em módulo autônomo `src/ui/calculator.js`.
  - Transição refinada da Base de Pesquisa Científica para a Calculadora com toast descritivo e auto-foco na dose pretendida.
- **Auditoria de Acessibilidade Automatizada com Axe no Playwright (P2):**
  - Validação contínua WCAG 2.1 AA em suites E2E com `@axe-core/playwright` em múltiplos viewports Android.
  - Conformidade estrita de atributos e roles ARIA (`role="region"`).

---

## 🚀 Novidades da Versão 2.5.0 (Auditoria Completa Codex, Health Connect Estrito, Exact Alarm e Pipeline de Migrações)

- **Sincronização Health Connect Resiliente & Proteção contra Sync Echo:**
  - Conversão pura de timestamps locais (`localDateTimeToIso` e `isoToLocalDateTime`) e preservação de `zoneOffset` histórico.
  - Identidade completa (`dataOrigin`, `healthConnectRecordId`, `clientRecordId`, `clientRecordVersion`, `zoneOffset`) e chaves compostas imunes a colisão entre apps distintos.
  - Prevenção total de Sync Echo: medições importadas de fontes externas recebem `ownership: "external"` e não são reexportadas.
  - Versionamento monotônico com `clientRecordVersion` para atualizações in-place sem duplicatas.
  - Sincronização de exclusões com rastreamento local de tombstones e chamada nativa a `deleteRecords` apenas para registros do PEP.
  - Mutex lock `isSyncing` e debounce de 1000ms na interface para prevenir concorrência e race conditions.
  - Tratamento fail-closed estrito em falhas de leitura/permissão e rejeição pura de datas/horários impossíveis.
- **Notificações Nativas Multi-Canal & Verificação de Exact Alarm:**
  - Configuração de dois `NotificationChannel`s no Android: `pep_lembretes` (som + vibração) e `pep_lembretes_silenciosos` (discreto sem som/vibração).
  - Verificação de `SCHEDULE_EXACT_ALARM` em runtime com solicitação de autorização direta do usuário (API 31+). A flag `allowWhileIdle: true` assegura que os lembretes acordem o dispositivo em modo Doze, enquanto a permissão de Exact Alarm garante a precisão ao minuto exato.
  - Centralização e eliminação de listeners redundantes de notificação na interface com foco acessível e ARIA.
- **Proteção Matemática de Doses em UI sem Concentração:**
  - Bloqueio automático de débito de estoque (`VIAL_MISSING_CONCENTRATION`) caso a dose esteja em UI e o frasco não possua concentração calculada, com diálogo explícito para permitir salvar apenas no histórico sem afetar o estoque.
- **Android SDK 36 & Conformidade com Google Play:**
  - Atualização completa de `compileSdkVersion` e `targetSdkVersion` para API 36 com bibliotecas AndroidX atualizadas.
  - Contrato nativo de permissões `PermissionController.createRequestPermissionResultContract()` com `@ActivityCallback` de ciclo de vida seguro.
  - Remoção da permissão restrita `USE_EXACT_ALARM` em conformidade com as diretrizes do Google Play.
- **Integridade Bidirecional Dose ↔ Movimento ↔ Frasco:**
  - O ID do log de dose (`doseLogId`) é pré-alocado e registrado no ledger de estoque antes da confirmação, garantindo rastreabilidade perfeita e estornos auditáveis.
- **Proteção Estrutural de Frascos & Soft-Delete:**
  - Frascos com histórico de movimentação têm dados estruturais (massa mg e diluente mL) travados contra alteração acidental (`PROTECTED_HISTORICAL_VIAL`).
  - Frascos com movimentações recebem descarte/arquivamento seguro (`archiveVial`), preservando o histórico de aplicações passadas sem exclusão física destrutiva.
- **Validadores Estritos de Data/Hora & Robustez no Backup:**
  - Validação uniforme com `isValidTime` e `isValidDateKey` (calendário gregoriano real com anos bissextos).
  - Medição em bytes UTF-8 reais com `TextEncoder` e tratamento defensivo (fail-closed) sem quebra de estado em importações JSON corrompidas.
- **Widget Inteligente & Resumo Diário Aperfeiçoado:**
  - O widget nativo 3x2 avança progressivamente para o próximo horário diário (`08:00` → `14:00` → `20:00` → `Tudo concluído`).
  - O resumo diário separa doses previstas de registros extras sem exibir anomalias como "3 de 1".
- **Cancelamento Seletivo de Lembretes & Sanitização de Busca:**
  - Cancelamento direcionado de notificações por peptídeo (`cancelScheduleForPeptide`) e sanitização de caracteres de controle na biblioteca científica.
- **Qualidade & Testes Automatizados:**
  - **234 testes unitários** no Vitest passando com 100% de sucesso.
  - **27 testes E2E** no Playwright cobrindo todos os fluxos críticos em 3 viewports móveis.
  - Testes unitários JUnit para Android em Kotlin (`HealthConnectTest.kt`) validados no Gradle.

---

## 🚀 Novidades da Versão 2.0.0 (Health Connect Real & Integridade Total)

- **Integração Real com o AndroidX Health Connect SDK:**
  - Migração completa do plugin nativo para Kotlin (`PepHealthConnectPlugin.kt`) utilizando a biblioteca oficial `androidx.health.connect:connect-client:1.1.0-alpha07`.
  - Verificação de status em tempo real (`HealthConnectClient.getSdkStatus()`) e solicitação de permissões reais de leitura e escrita de registros de peso (`WeightRecord`).
  - Sincronização bidirecional de peso corporal com balanças inteligentes e aplicativos de saúde (Google Fit, Samsung Health, etc.).
  - Declaração de `activity-alias` de privacidade (`ViewPermissionUsageActivity`) e rationale de permissões em conformidade com as diretrizes da Google Play Store.
- **Integridade Atômica Dose ↔ Inventário (`DoseService`):**
  - Camada de serviço atômica unificada (`src/domain/dose-service.js` e `src/services/dose-service.js`) gerenciando registros de doses e movimentações de estoque.
  - Vínculo estrito de `vialId` e `inventoryMovementId` em cada aplicação.
  - Validação estrita de saldo de frasco: bloqueio e feedback explícito `INSUFFICIENT_BALANCE` sem criar logs órfãos.
  - Estorno inteligente de doses desfeitas restaurando o saldo exatamente no frasco original, reabrindo frascos com status `finished` para `active`.
  - Exclusão de doses retroativas que não debitaram estoque não geram créditos indevidos.
- **Storage Seguro & Rollback Imutável:**
  - Todos os getters (`getPeptides`, `getLogs`, `getInventory`, `getSites`, `getMeasurements`) em `src/services/storage.js` retornam clones profundos imutáveis (`deepClone()`), impedindo que mutações acidentais corrompam os snapshots de rollback.
- **Blindagem contra Vulnerabilidades de Segurança:**
  - **Anti-XSS:** Sanitização estrita com `escapeHTML()` em todas as interpolações do relatório impresso via iframe.
  - **CSV Formula Injection:** Mitigação de injeção de comandos em planilhas (`=`, `+`, `-`, `@`, `\t`) prefixando células com `'` em `src/domain/report.js`.
- **Rigor Matemático & Validações Temporais:**
  - Helpers puros de validação `isValidTime` (`HH:MM`) e `isValidDateKey` (`YYYY-MM-DD`) com checagem de anos bissextos e limites de calendário.
  - Cálculo de intervalos entre datas (`daysBetween`) normalizado em timestamps UTC, imune a variações de 23h/25h de Horário de Verão (DST).
  - Validação explícita de unidades (`mg`, `mcg`) na calculadora de reconstituição.
  - Cálculo de meta e progresso diário no Dashboard e no Widget nativo respeitando doses múltiplas (`perDay`).
- **Resiliência de Backup & Migrações:**
  - Rejeição segura de arquivos de backup gerados por versões de schema futuras (`version > CURRENT_SCHEMA_VERSION`).
  - Migrações automáticas garantindo integridade de estruturas em importações legadas.
- **Acessibilidade Aprimorada (WCAG 2.1 AA):**
  - Diálogos de confirmação (`showConfirmDialog`) com foco inicial no botão Cancelar (prevenindo ações destrutivas acidentais), focus trap interno e suporte ao fechamento com tecla `Escape`.
- **Qualidade & Testes Automatizados:**
  - **188 testes unitários** no Vitest passando com 100% de sucesso.
  - **24 testes E2E** no Playwright cobrindo todos os fluxos críticos e alvos de toque em múltiplos viewports móveis.

---

## 🚀 Novidades da Versão 1.9.9 (Evolução Visual & Arquitetural)

- **Arquitetura Resiliente & Fail-Closed:**
  - Orquestrador de persistência seguro (`committed-action`): nenhum feedback visual, tátil (`haptics`) ou rotação de inventário é acionado antes da confirmação de escrita em disco.
- **Design System Acessível & Ergonomia Mobile:**
  - Paleta com contraste WCAG 2.1 AA auditado ($\ge 4.5:1$) sobre fundos escuros OLED e claros.
  - Dimensão de toque mínima de $44 \times 44\text{ px}$ em todos os botões e alvos interativos, e barra de navegação com altura $\ge 48\text{ px}$.
- **Redesenho do Dashboard & Fluxo Diário:**
  - Estado vazio contextual *"Seu protocolo começa aqui"* com CTA limpo de criação, eliminando contadores zerados confusos (`0%` e `0/0`).
  - Cards da rotina diária enriquecidos com badges de status textuais (*Pendente* / *Aplicado*), horário, saldo de frasco e rotação de sítio de aplicação.
  - Seção de **Próximas Aplicações** calculando cronologicamente os próximos dias da rotina.
- **Calculadora com Dupla Conferência & Régua U-100:**
  - Escala visual de seringa calibrada iniciando no marco zero (0 UI até 100 UI).
  - Card explícito *"Confira os dados usados"* (Frasco mg, Diluente mL e Dose pretendida) com cálculo automático e validação de botões de ação.
- **Visão Semanal Responsiva & Estável:**
  - Rolagem horizontal interna (`.week-scroll`) sem estourar a tela em dispositivos compactos (360px).
  - Primeira coluna de compostos fixa (`position: sticky; left: 0`) para fácil identificação durante o scroll.
  - Legenda informativa completa (*Aplicado*, *Pendente*, *Não programado*).
- **Ajustes Estruturados em 4 Grupos Semânticos:**
  1. *Aparência e Acessibilidade* (Idioma, Modo de Alto Contraste).
  2. *Segurança e Notificações* (Bloqueio PIN/Biometria, Widget Discreto, Lembretes Locais).
  3. *Dados e Inventário* (Frascos Reconstituídos, Sítios, Health Connect, Backup JSON).
  4. *Sobre o App e Ajuda* (Diagnósticos Técnicos, Termos & Privacidade).
- **Estados de Dose Avançados & Tendências Descritivas:**
  - Registro de doses além do binário: suporte a `applied` (aplicada), `skipped` (pausa) e `missed` (esquecida) com motivo.
  - Estatísticas de variação de peso ($\Delta\text{ kg}$) e sintomas estritamente descritivas sem inferências médicas.
- **Suíte de Testes Automatizada & CI/CD:**
  - 173 testes unitários no `vitest` e 24 testes E2E multi-viewport no `playwright` com verificação de runtime limpo.
  - Validação nativa completa no emulador Android e build automatizado no GitHub Actions.

---

## 🚀 Novidades Anteriores (Versão 1.9.0)

- **Refinamento Completo para Português Brasileiro (PT-BR) Natural & Não Prescritivo:**
  - Terminologia correta para compostos injetáveis no Dashboard: *"0 / 2 aplicados hoje"*.
  - Ação direta e moderna no card de peptídeos com alternância de estado: botão **`Aplicar`** ➔ **`✓ Aplicado`**.
  - Instrução precisa de manuseio na Calculadora de Reconstituição: *"Aspire até a marca de X UI na seringa de 100 UI"*.
  - Linguagem estritamente não prescritiva em conformidade com as diretrizes de governança médica (`AGENTS.md`): *"Informe a dose pretendida"*.
  - Gerenciamento simplificado de **`Locais de Aplicação`** com alternância sequencial inteligente e histórico.
- **Acessibilidade Contínua — WCAG 2.1 AA:**
  - **Modo de Alto Contraste AAA (> 7:1):** Novo seletor no painel de Ajustes para legibilidade sob alta luminosidade.
  - **Focus Trap Acessível:** Navegação com leitor de tela / teclado isolada com foco seguro no modal ativo e fechamento instantâneo via tecla Escape ou botão Voltar do Android.
  - **Anunciador TalkBack (`aria-live="polite"`):** Feedback falado em segundo plano para confirmações de doses e ações críticas.
  - **Redução de Movimento:** Respeito integral à preferência de acessibilidade do sistema (`prefers-reduced-motion: reduce`).
- **Base de Pesquisa Científica & Farmacocinética Offline:**
  - Catálogo integrado com 12 compostos clássicos (*BPC-157, TB-500, Semaglutida, Tirzepatida, GHK-Cu, CJC-1295, Ipamorelina, Tesamorelin, Epitalon, etc.*).
  - Consulta rápida de meias-vidas relatadas, conservação, solventes, mecanismos propostos e referências do PubMed.
  - Integração com um toque para carregar parâmetros na Calculadora ou adicionar ao Protocolo.
- **Internacionalização Multi-idioma Offline (i18n):**
  - Suporte completo a **Português (Brasil)**, **English** e **Español** com alternância instantânea em Ajustes.
- **Segurança Biométrica / PIN & Widget Android:**
  - Bloqueio por biometria / PIN nativo ao retornar ao aplicativo.
  - Widget nativo 3x2 para tela inicial com atualização em tempo real e modo discreto de privacidade.
- **Inventário de Frascos & Acompanhamento de Medidas:**
  - Saldo automático em mcg e rendimento restante de doses por frasco reconstituído.
  - Registro de peso corporal e medidas com suporte à integração Health Connect.

---

## 🚀 Novidades Anteriores (Versão 1.7.0)

- **Barra de Pesquisa em Tempo Real de Peptídeos:** Novo campo de busca instantânea (`🔍 Buscar peptídeo ou categoria...`) no modal de criação de protocolo, permitindo encontrar rapidamente compostos por nome (ex: *BPC*, *Tirzepatida*, *Epitalon*) ou por classe terapêutica/categoria (ex: *GLP-1*, *reparo*, *sono*, *mitocondrial*).
- **Lista Vertical Minimalista & Fluida:** Substituição dos chips horizontais por uma lista vertical limpa com rolagem suave, exibindo nome em destaque e categoria discreta à direita.
- **Preenchimento Automático Inteligente:** Ao selecionar qualquer composto da biblioteca, os campos de nome e subtítulo são preenchidos automaticamente com destaque cromático (`.selected`) e feedback tátil (`@capacitor/haptics`), mantendo total liberdade para personalizar doses e horários.
- **Visibilidade Contextual:** A barra de busca e a biblioteca de compostos são exibidas exclusivamente no fluxo de adição, sendo ocultadas ao editar um peptídeo existente para focar na alteração de doses e dias.

---

## 🚀 Novidades Anteriores (Versão 1.6.0)

- **Novo Ícone de Aplicativo Personalizado:** Identidade visual moderna e exclusiva combinando a **dupla hélice de DNA**, a precisão de uma **microsseringa platinada** e **esferas de ligações peptídicas** brilhantes em ciano/esmeralda (`#2CC5C0`) sobre fundo escuro OLED (`#080C11`).
- **Suporte Completo a Ícones Adaptativos do Android:** Assets gerados com interpolação Lanczos para todas as densidades de tela (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) com zona de segurança perfeitamente enquadrada.
- **Logotipo e Branding no Cabeçalho:** O cabeçalho superior do app agora integra o novo ícone estilizado com cantos arredondados suaves (`border-radius: 8px`), harmonizando com a interface do Dashboard.
- **Assets Web & PWA de Alta Resolução:** Atualização de `icon-180.png`, `icon-192.png` e `icon-512.png`.

---

## 🚀 Novidades Anteriores (Versão 1.5.0)

- **Canal Direto de Feedback & Sugestões:** O card de destaque do Dashboard (*"📢 Toda opinião importa! Fale conosco ou envie sugestões"*) agora é clicável e integrado com o aplicativo de e-mail padrão do Android (Gmail / cliente nativo), disparando a composição direta para `lguscouto@gmail.com`.
- **Preenchimento Inteligente de E-mail:** Assunto e corpo do e-mail são automaticamente estruturados com campos para a mensagem do usuário e identificação da versão (`v1.5.0 · Android`).
- **Isolamento Confiável de Ações:** O botão de fechar (`✕`) utiliza controle estrito de eventos (`stopPropagation`), garantindo que o fechamento do banner ocorra de forma instantânea sem disparar o cliente de e-mail.
- **Interatividade & Haptics Aprimorados:** Efeito visual de escala `:active` e vibração tátil nativa (`@capacitor/haptics`) ao tocar no canal de feedback.

---

## 🚀 Novidades Anteriores (Versão 1.4.0)

- **Transformação Completa em Dashboard:** A tela principal foi redesenhada e renomeada para **Dashboard**, trazendo uma visão centralizada e rica em informações com ícone temático de grid de painel na barra inferior.
- **Hero Card de Progresso com Anel Gráfico SVG:** Exibição dinâmica da porcentagem exata (`0%` a `100%`) no centro do anel e métricas de doses em tipografia display (`X / Y tomados hoje`).
- **Banner Informativo & Canal de Sugestões:** Faixa de comunicação (`📢 Toda opinião importa!`) com dismiss persistente no armazenamento local.
- **Cartões de Compostos com Accent Line:** Identificação cromática através de barra lateral correspondente à cor do peptídeo, com badges de UI, frequência, concentração e notas.
- **Barra de Ações Rápidas do Dashboard (Grid 2x2):**
  - 🔗 **Compartilhar:** Gera resumo textual do protocolo e dispara o compartilhador nativo Android (`navigator.share`).
  - ⬇️ **Exportar:** Gera e baixa o backup JSON seguro do protocolo e histórico.
  - ⬆️ **Importar:** Atalho direto para upload de arquivo e restauração atômica.
  - 🧮 **Calculadora:** Acesso imediato à ferramenta de reconstituição.
- **Rodapé de Governança & Transparência Médica:** Disclaimer de segurança, precisão matemática e privacidade 100% offline.

---

## 🚀 Novidades Anteriores (Versão 1.3.0)

- **Modal de Confirmação In-App Confiável:** Substituição do diálogo `window.confirm()` por um modal nativo in-app assíncrono (`#confirm-modal`), corrigindo falhas silenciosas de exclusão de peptídeos no Android WebView.
- **Exclusão Rápida no Editor:** Adicionado botão de ação rápida "Excluir" em destaque no rodapé do modal de edição (`#edit-modal`).
- **Interatividade no Calendário Semanal:** Os nomes dos peptídeos na grade semanal agora são clicáveis e abrem diretamente o painel de edição e gerenciamento.
- **Sincronização Reativa Total:** Ao excluir ou editar um peptídeo, a tabela semanal, a lista do Dashboard, o anel de progresso, o histórico e as notificações nativas são recalculados e atualizados instantaneamente.

---

## 🚀 Novidades Anteriores (Versão 1.2.0)

- **Arquitetura Pura de Domínio (`src/domain/`):** Isolamento total da lógica de negócio, eliminando acoplamentos com o DOM e garantindo testabilidade pura.
- **Persistência Fail-Closed & Atômica (`src/services/storage.js`):** Snapshot automático antes de operações de gravação e rollback imediato em caso de erro.
- **Calculadora de Reconstituição Canônica:** Conversões rigorosas entre `mcg` e `mg`, validações de capacidade de seringas U-100 e visualização de êmbolo SVG.
- **Notificações Nativas Confiáveis:** Agendamento com horizonte de 14 dias concretos e rotina de cancelamento real via `@capacitor/local-notifications`.
- **Suíte de Testes Unitários:** 35 testes unitários automatizados com Vitest cobrindo todos os módulos de domínio e regras de negócio.
- **Pipeline de Integração Contínua (CI):** Validação automática com GitHub Actions para Node 22, testes Vitest, compilação Vite e build Android Gradle.
- **Governança & Privacidade:** Primeiro acesso com protocolo limpo e documentação contratual (`docs/PRODUCT.md`, `docs/PRIVACY.md`, `AGENTS.md`).

---

## 📱 Destaques do Projeto

- **⚡ 100% Local-First (Offline por Padrão):** O app opera totalmente sem internet. Nenhum dado de saúde é transmitido a servidores remotos.
- **🛡️ Confiabilidade Matemática & Domínio Puro:**
  - Conversões canônicas em microgramas (`mcg`) e mililitros (`mL`) com validação de capacidade da seringa U-100.
  - Motor de agenda puro (`src/domain/schedule.js`) que unifica a visão "Hoje", a grade "Semana" e os alarmes.
- **🌓 Temas Branco e Preto (Light & True Black OLED):**
  - **Tema Preto:** Fundo preto puro (`#080C11`), otimizado para telas OLED com economia de bateria.
  - **Tema Branco:** Alto contraste e excelente legibilidade sob luz solar.
  - **Sincronização Nativa da Barra de Status:** A cor da Status Bar se adapta dinamicamente.
- **🔔 Notificações Nativas Confiáveis:** Integração com o `AlarmManager` do Android via `@capacitor/local-notifications`, agendando horizonte concreto e permitindo cancelamento real de pendências.
- **📳 Haptic Feedback:** Vibrações táteis nativas (`@capacitor/haptics`) ao marcar aplicações e interagir com seletores.
- **💾 Backup Seguro e Reversível:** Validação de esquema com contagens de prévia, limites de payload e transação atômica com rollback.
- **⚖️ Aviso Médico & Não Prescrição:** Primeiro uso limpo, disclaimers em destaque e respeito às diretrizes de aplicativos de saúde.

---

## 📂 Estrutura Arquitetural

```
pep-protocol/
├── src/
│   ├── main.js                  # Controlador e interface
│   ├── domain/                  # Lógica pura e auditável (sem dependência do DOM)
│   │   ├── calculator.js        # Reconstituição, conversão e limites
│   │   ├── schedule.js          # Motor de agendamento e ocorrências
│   │   ├── dose-service.js      # Transições puras de doses e inventário
│   │   ├── inventory.js         # Ledger e saldos de frascos
│   │   ├── health-connect.js    # Mapeamento e fusão de dados de saúde
│   │   ├── protocol.js          # Entidades e sanitização
│   │   ├── backup.js            # Validação e serialização segura
│   │   └── migrations.js        # Migrações de dados idempotentes
│   ├── services/
│   │   ├── storage.js           # Persistência observável com rollback e deepClone
│   │   ├── dose-service.js      # Serviço transacional atômico de doses
│   │   ├── health-connect.js    # Integração com o plugin Health Connect
│   │   ├── notifications.js     # Alarmes e notificações locais
│   │   ├── theme.js             # Gerenciamento de temas e status bar
│   │   ├── haptics.js           # Feedback tátil nativo
│   │   └── app-bridge.js        # Botão voltar e ciclo de vida
│   ├── ui/
│   │   ├── dom.js               # Construtor seguro e sanitização anti-XSS
│   │   ├── retro-log.js         # Modal e fluxo de registro retroativo
│   │   ├── health-connect.js    # Painel de sincronização de saúde
│   │   └── diagnostics.js       # Diagnósticos técnicos desidentificados
│   ├── data/                    # Catálogo nominal de referência
│   └── css/                     # Estilos modulares e responsivos
├── tests/
│   ├── unit/                    # 229 testes unitários com Vitest
│   └── e2e/                     # 24 testes E2E com Playwright
├── docs/
│   ├── PRODUCT.md               # Contrato do produto e público-alvo
│   └── PRIVACY.md               # Política de privacidade Local-First
├── android/                     # Projeto nativo Android (Gradle, Kotlin & Capacitor)
└── .github/workflows/           # CI automatizado com GitHub Actions
```

---

## 🚀 Executar, Testar e Compilar

### 1. Instalação
```bash
npm install
```

### 2. Executar Suíte de Testes Unitários
```bash
npm test
```

### 3. Executar Testes E2E (Playwright)
```bash
npm run test:e2e
```

### 4. Compilar Web & Sincronizar com Android
```bash
npm run cap:sync
```

### 5. Compilar APK Release Android
```bash
npm run android:build
```
O APK gerado estará em:
`android/app/build/outputs/apk/release/app-release-unsigned.apk` (ou em `debug/app-debug.apk`)

---

## 📄 Governança & Políticas
- [Contrato do Produto](docs/PRODUCT.md)
- [Política de Privacidade](docs/PRIVACY.md)
- [Diretrizes de Engenharia](AGENTS.md)
