# 🧪 Protocolo PEP · App Android (Local-First)

Aplicativo Android nativo para acompanhamento de protocolos de peptídeos, cálculo de reconstituição e registro diário de doses, construído com arquitetura **100% Local-First** e suporte aos **temas Branco e Preto (Dark/OLED)**.

---

## 📱 Destaques do Projeto

- **⚡ 100% Local-First (Offline por Padrão):** O app funciona instantaneamente no dispositivo sem necessidade de conexão com a internet ou telas de bloqueio de login. Todos os dados são salvos localmente com máxima privacidade e velocidade.
- **🌓 Temas Branco e Preto (Light & True Black OLED):**
  - **Tema Preto:** Fundo preto puro (`#080C11`), ideal para telas OLED/AMOLED com economia de bateria e conforto visual noturno.
  - **Tema Branco:** Fundo limpo e alto contraste para leitura clara em ambientes iluminados.
  - **Sincronização Nativa da Barra de Status:** A cor da Status Bar do Android se adapta dinamicamente ao tema ativo.
- **🔔 Notificações Locais Confiáveis:** Integração nativa com o `AlarmManager` do Android via `@capacitor/local-notifications`, disparando lembretes de doses no horário configurado mesmo com o app fechado.
- **📳 Haptic Feedback:** Vibrações táteis nativas (`@capacitor/haptics`) ao marcar doses e interagir com o app.
- **💉 Calculadora de Reconstituição Interativa:** Cálculo automático de concentração (mg/ml), doses por frasco, unidades UI e renderização interativa do êmbolo da seringa U-100 em SVG.
- **📅 Acompanhamento Semanal & Histórico:** Grade semanal interativa com marcação de doses e histórico cronológico completo.
- **💾 Backup & Restauração JSON:** Exportação e importação offline de todo o protocolo e histórico para arquivos `.json`.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** JavaScript Moderno (ES2020+), CSS3 Modular, HTML5
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Mobile Engine:** [Capacitor 6](https://capacitorjs.com/)
- **Nativo Android:** Gradle, Java/Kotlin, Android SDK (minSdk 24 até API 34/35)

---

## 📂 Estrutura do Projeto

```
pep-protocol/
├── src/
│   ├── main.js                  # Controlador principal da aplicação
│   ├── css/                     # Estilos modulares (variables, base, components, animated-bg)
│   ├── data/                    # Catálogo offline e paleta de cores
│   └── services/
│       ├── storage.js           # Gerenciador de persistência Local-First
│       ├── theme.js             # Gerenciador de temas e Status Bar nativa
│       ├── notifications.js     # Agendador nativo de alarmes e notificações
│       ├── haptics.js           # Feedback tátil nativo
│       └── app-bridge.js        # Tratamento do ciclo de vida e botão Voltar
├── public/                      # Ícones e assets estáticos
├── android/                     # Projeto nativo Android (Gradle)
├── capacitor.config.json        # Configuração do Capacitor
├── vite.config.js               # Configuração do Vite Bundler
└── package.json                 # Dependências e scripts
```

---

## 🚀 Como Executar e Compilar

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v18+)
- [Android SDK](https://developer.android.com/studio) instalado

### Instalação
```bash
npm install
```

### Desenvolvimento Web
```bash
npm run dev
```

### Compilar Web & Sincronizar com Android
```bash
npm run cap:sync
```

### Compilar APK Nativo Debug
```bash
npm run android:build
```
O arquivo APK gerado estará em:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📄 Licença

Distribuído sob licença livre para uso e customização.
