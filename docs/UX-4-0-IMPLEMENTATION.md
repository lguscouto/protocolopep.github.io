# Protocolo PEP 3.9.13 — polimento final de UI/UX

Entrega de avaliação na branch `codex/pep-ux-3-9-13`, criada a partir da `main` no commit `f0ed322`. A versão implementa os itens P0–P3 da auditoria sem alterar schemas, chaves de storage, backups, fórmulas, `DoseService`, inventário, Health Connect ou o funcionamento Local-First/offline.

## Escopo e limitação

A navegação permanece **Hoje / Jornada / Progresso / Mais**, com o FAB global `+ Registrar`. Histórico e medições usam revelação acumulativa em lotes de 30, a topbar acompanha a view e o idioma, Mais mantém menu e painel único, e os fluxos tocados usam foco, safe-area e alvos acessíveis. Os ícones da navegação são SVGs locais; o modal de notificações tem uma única ação de fechamento; o inventário alterna os CTAs conforme o estado.

O teste em aparelho físico **não foi executado por decisão de escopo**. A validação Android desta entrega usa `cap sync`, testes nativos, lint, build e emulação automatizada. O APK é uma build debug para avaliação e não é descrito como 100% operacional.

## Mapa de acesso

| Recurso | Destino em 3.9.13 |
| --- | --- |
| Próxima aplicação, registros do dia e registros rápidos | Hoje e `+ Registrar` |
| Agenda e próximos sete dias | Jornada > Próximos |
| Histórico, edição, exclusão, relatório e aplicação anterior | Jornada > Histórico > Mais ações |
| Evolução, gráficos, metas, regularidade e detalhes de medidas | Progresso |
| Peso, sintomas e medidas | `+ Registrar` (modos rápidos e completo) |
| Tratamentos, frascos e locais | Mais > Tratamento |
| Calculadora, pesquisa e relatórios | Mais > Ferramentas |
| Health Connect, backup, importar, exportar e compartilhar | Mais > Dados |
| Notificações, aparência, idioma, acessibilidade, segurança e widget | Mais > App |
| Termos, privacidade, sugestão, diagnósticos e sobre | Mais > Ajuda |

## Commits por área

- `92af895` — `fix(ui): fazer Carregar mais acumular itens`.
- `fc707c4` — `refactor(ui): alinhar topbar e hierarquia da Jornada`.
- `0c5caa3` — `fix(ui): evitar competição entre FAB e CTAs`.
- `89d6cde` — `refactor(ui): compactar menu Mais e eliminar truncamentos`.
- `ce04e4f` — `refactor(ui): diferenciar ícones da navegação`.
- `6c02a0a` — `refactor(ui): simplificar modal de notificações`.
- `e685402` e `bc4c8d0` — baselines visuais Windows/Linux e estados de Mais.
- `2351e5f` — `chore(release): preparar versão 3.9.13 e versionCode 42`.
- `b7b524b` — correção de atualização da data da topbar ao trocar idioma.

O commit que congelou o código usado para o APK é `b7b524b`. A documentação final e a tag serão commits posteriores; nenhum deles altera o runtime incluído no APK.

## Validação automatizada

- `npm ci`: executado para a instalação limpa; o lockfile permaneceu consistente.
- `npm test`: **565/565 testes aprovados em 57 arquivos**.
- `npm run build`: aprovado com Vite 8.3.0; entry JavaScript **69.640 bytes gzip (68,0 KiB)**, abaixo do teto de 80 KiB.
- `npm run test:e2e`: fluxos de registro, Jornada, Progresso, Mais, acessibilidade, notificações, inventário, visual e Galaxy A55 emulado aprovados; os cenários condicionais permanecem ignorados quando o ambiente não oferece o recurso.
- `npm run test:performance`: aprovado. Medianas no cenário vazio: DOM ready 300 ms, first content 184 ms, long tasks 158 e 799 nós; no cenário carregado: DOM ready 2.368,4 ms, first content 204 ms, long tasks 2.316 e 1.022 nós. Primeiro acesso carregado: Jornada 9,8 ms, Progresso 65,2 ms e Mais 15,9 ms; acesso aquecido: 9,6 ms, 86 ms e 17,7 ms. Os limites mantêm regressão máxima de 20% para tempos, 25% para long tasks, 5% para nós e o teto de 80 KiB.
- `npm audit --omit=dev`: **0 vulnerabilidades**.
- `npm audit` completo: três ocorrências moderadas transitivas restritas à toolchain de desenvolvimento (`@capacitor/cli`/`xcode`/`uuid`); nenhuma correção com `--force` foi usada.
- Android: `npx cap sync android`, `testDebugUnitTest`, `lintDebug` e `assembleDebug` aprovados localmente e no job Android da CI.
- Snapshots: estados de Mais, Android small/standard/wide e Galaxy A55 retrato/paisagem foram revisados e atualizados em Windows/Linux no runner Linux, com `maxDiffPixelRatio` mantido em 0,03.

CI final da branch: [34784475206](https://github.com/lguscouto/protocolopep.github.io/actions/runs/34784475206), com Web/E2E, Performance e Android verdes no commit `66728c4`.

## APK de avaliação da 3.9.13

Nome: `Protocolo-PEP-v3.9.13.apk`

Commit de origem: `66728c4`

Bytes: **12.378.387**

SHA-256 local: **`2D3D6543C8693CBA426F034654D1359BFF9E2F058A4D1D58EB76F0353889A333`**

O APK é uma build debug para avaliação. O teste físico não foi executado e não é um gate desta versão. O asset hospedado foi baixado novamente e mantém **12.378.387 bytes** e SHA-256 **`2D3D6543C8693CBA426F034654D1359BFF9E2F058A4D1D58EB76F0353889A333`**, idênticos ao arquivo local.

## Releases anteriores

- [v3.9.12](https://github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.12) — `Protocolo-PEP-v3.9.12.apk`.
- [v3.9.11](https://github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.11) — `Protocolo-PEP-v3.9.11.apk`.

Cada release mantém uma única referência ao seu APK oficial.

## Roteiro de smoke físico (execução posterior)

Instalar o APK debug, atualizar a partir da 3.9.12, abrir Hoje/Jornada/Progresso/Mais, registrar uma aplicação e uma medição, confirmar notificações e ações, testar widget, bloqueio biométrico, Health Connect, exportação/importação de arquivos e haptic, e verificar retomada, Voltar, rotação e teclado. **Teste em aparelho físico: não executado por decisão de escopo.**

## Fechamento da release

Integração fast-forward concluída em `main` no commit `66728c4`. A CI final do commit integrado é o run [34784923858](https://github.com/lguscouto/protocolopep.github.io/actions/runs/34784923858), com Web/E2E, Performance e Android verdes. A CI do commit documental `2f4b7ba` é o run [34786451801](https://github.com/lguscouto/protocolopep.github.io/actions/runs/34786451801), também verde. A tag anotada [`v3.9.13`](https://github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.13) aponta para `5997217`, e a [release pública](https://github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.13) está publicada como não draft e não prerelease. O commit de origem do APK (`66728c4`), os commits documentais (`5997217`, `7a959c7` e `2f4b7ba`), o commit da tag (`5997217`) e o digest hospedado são mantidos separados para rastreabilidade.
