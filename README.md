# 🧪 Protocolo PEP · App Android (Local-First)

![Version](https://img.shields.io/badge/version-1.9.0-2CC5C0)
![Android](https://img.shields.io/badge/Android-8.0%2B-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://github.com/lguscouto/protocolopep.github.io/actions/workflows/ci.yml/badge.svg)

Aplicativo Android nativo para acompanhamento de protocolos de peptídeos, cálculo de reconstituição e registro diário de doses, construído com arquitetura **100% Local-First**, segurança matemática auditável e suporte aos **temas Branco e Preto OLED**.

---

## 🚀 Novidades da Versão 1.9.0

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
│   │   ├── protocol.js          # Entidades e sanitização
│   │   ├── backup.js            # Validação e serialização segura
│   │   └── migrations.js        # Migrações de dados idempotentes
│   ├── services/
│   │   ├── storage.js           # Persistência observável com rollback
│   │   ├── notifications.js     # Alarmes e notificações locais
│   │   ├── theme.js             # Gerenciamento de temas e status bar
│   │   ├── haptics.js           # Feedback tátil nativo
│   │   └── app-bridge.js        # Botão voltar e ciclo de vida
│   ├── ui/
│   │   └── dom.js               # Construtor seguro e sanitização anti-XSS
│   ├── data/                    # Catálogo nominal de referência
│   └── css/                     # Estilos modulares e responsivos
├── tests/
│   └── unit/                    # Suíte completa de testes com Vitest
├── docs/
│   ├── PRODUCT.md               # Contrato do produto e público-alvo
│   └── PRIVACY.md               # Política de privacidade Local-First
├── android/                     # Projeto nativo Android (Gradle)
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

### 3. Compilar Web & Sincronizar com Android
```bash
npm run cap:sync
```

### 4. Compilar APK Debug Android
```bash
npm run android:build
```
O APK gerado estará em:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📄 Governança & Políticas
- [Contrato do Produto](docs/PRODUCT.md)
- [Política de Privacidade](docs/PRIVACY.md)
- [Diretrizes de Engenharia](AGENTS.md)
