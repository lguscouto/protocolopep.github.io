# 🧪 Protocolo PEP · App Android (Local-First)

Aplicativo Android nativo para acompanhamento de protocolos de peptídeos, cálculo de reconstituição e registro diário de doses, construído com arquitetura **100% Local-First**, segurança matemática auditável e suporte aos **temas Branco e Preto OLED**.

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
