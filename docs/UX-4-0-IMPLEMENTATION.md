# Protocolo PEP 3.9.12 — fechamento de UI/UX, i18n e desempenho

Entrega de avaliação na branch `codex/pep-ux-3-9-12`, criada a partir da `main` no commit `badbfd6`. A versão consolida os achados P1/P2 da auditoria sem alterar schemas, chaves de storage, fórmulas, `DoseService`, inventário, Health Connect ou o funcionamento Local-First/offline.

## Escopo e limitação

Foram localizados os fluxos de aplicação e medições, relatórios/CSV/PDF, notificações, diagnósticos e mensagens de erro. A interface mantém Hoje, Jornada, Progresso, Mais e `+ Registrar`; Mais usa menu e painel único; Histórico e medições têm paginação acessível; o startup usa snapshot revisionado e prefetch em estágios; ícones funcionais são SVGs locais e os estilos tocados usam classes compatíveis com os três temas.

O teste em aparelho físico **não foi executado por decisão de escopo**. A validação Android desta entrega usa `cap sync`, testes nativos, lint, build e emulação automatizada. O APK é debug para avaliação e não é descrito como 100% operacional.

## Mapa de acesso

| Recurso | Destino em 3.9.12 |
| --- | --- |
| Próxima aplicação, registros do dia e registros rápidos | Hoje e `+ Registrar` |
| Agenda e próximos sete dias | Jornada > Próximos |
| Histórico, edição, exclusão, relatório e registro retroativo | Jornada > Histórico > Mais ações |
| Evolução, gráficos, metas, regularidade e detalhes de medidas | Progresso |
| Peso, sintomas e medidas | `+ Registrar` (modos rápidos e completo) |
| Tratamentos, frascos e locais | Mais > Tratamento |
| Calculadora, pesquisa e relatórios | Mais > Ferramentas |
| Health Connect, backup, importar, exportar e compartilhar | Mais > Dados |
| Notificações, aparência, idioma, acessibilidade, segurança e widget | Mais > App |
| Termos, privacidade, sugestão, diagnósticos e sobre | Mais > Ajuda |

## Commits por área

- `e2807b5`, `93c9fcf`, `d1d2f33` — localizar fluxos críticos e remover hardcodes residuais.
- `6a79cd8`, `56008ef` — localizar relatórios, CSV, PDF e cabeçalhos de exportação.
- `6f93ffc`, `18d6a60`, `c2fabf5`, `be47883`, `472e469` — endurecer snapshots funcionais e baselines Linux/Ubuntu.
- `b9104c7`, `7ca4a3d`, `a43425b`, `4e04327` — paginação, snapshot de Hoje, prefetch e remediação de dados legados.
- `fa277d8`, `d168c80` — mensagens de erro estáveis, feedback e ícones SVG locais.
- `37df4c5` — versão 3.9.12 e `versionCode 41`.

O commit que congelou o código usado para o APK é `472e469` (somente testes/documentação visual foram alterados depois; nenhum código de runtime foi modificado).

## Validação automatizada

- `npm ci`: aprovado no job Web/E2E da CI com Node 22.21.1.
- `npm test`: **564/564 testes em 57 arquivos aprovados**.
- `npm run build`: aprovado com Vite 8.3.0; entry JavaScript **68.806 bytes gzip (67,2 KiB)**, abaixo do teto de 80 KiB.
- `npm run test:e2e`: **187 aprovados e 7 cenários condicionais ignorados** (194 cenários) no job Web/E2E; inclui registro, Jornada, Progresso, Mais, acessibilidade, visual e Galaxy A55 emulado.
- `npm run test:performance`: aprovado. Medianas observadas no cenário vazio: DOM ready 324,9 ms, first content 204 ms, long tasks 163 e 799 nós; no cenário carregado: DOM ready 2.636 ms, first content 216 ms, long tasks 2.581 e 1.022 nós. Primeiro acesso carregado: Jornada 10,5 ms, Progresso 91,6 ms e Mais 17,3 ms. Os limites mantêm regressão máxima de 20% para tempos, 25% para long tasks, 5% para nós e o teto de 80 KiB.
- Android: `npx cap sync android`, `testDebugUnitTest`, `lintDebug` e `assembleDebug`: aprovados localmente e no job Android.
- `npm audit --omit=dev`: **0 vulnerabilidades**.
- `npm audit` completo: três ocorrências moderadas transitivas restritas à toolchain de desenvolvimento (`@capacitor/cli`/`xcode`/`uuid`); nenhuma correção com `--force` foi usada.

CI final da branch: [34769060945](https://github.com/lguscouto/protocolopep.github.io/actions/runs/34769060945), com Web/E2E, Performance e Android verdes.

## APK de avaliação da 3.9.12

Nome: `Protocolo-PEP-v3.9.12.apk`  
Commit de origem: `472e469`  
Bytes: **12.376.448**  
SHA-256 local: `3A4ABAD547471BC8907545FC2CF3DB494ED42612E031179C0AB1DB22C1DE4173`

O APK é uma build debug para avaliação. O teste físico não foi executado e não é um gate desta versão.

## Releases anteriores

- [v3.9.11](https://github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.11) — `Protocolo-PEP-v3.9.11.apk`.
- [v3.9.10](https://github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.10) — `Protocolo-PEP-v3.9.10.apk`.

Cada release mantém uma única referência ao seu APK oficial; o asset da 3.9.12 será confirmado após a publicação.

## Roteiro de smoke físico (execução posterior)

Instalar o APK debug, atualizar a partir da 3.9.11, abrir Hoje/Jornada/Progresso/Mais, registrar uma aplicação e uma medição, confirmar notificações e ações, testar widget, bloqueio biométrico, Health Connect, exportação/importação de arquivos e haptic, e verificar retomada, Voltar, rotação e teclado. **Teste em aparelho físico: não executado por decisão de escopo.**

## Fechamento da release

Após a integração fast-forward, esta seção será complementada com o commit final de `main`, o run da CI de `main`, o commit apontado pela tag anotada `v3.9.12`, a URL da release pública e o SHA-256 do asset hospedado comparado ao valor local acima.
