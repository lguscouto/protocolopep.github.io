# Protocolo PEP 3.9.10 — consolidação da auditoria UI/UX

Entrega de avaliação na branch `codex/pep-ux-4-0-polish`, criada a partir da tag `v3.9.9`. A implementação preserva o funcionamento Local-First/offline, os formatos de dados e os recursos avançados. Não houve merge em `main`.

## Escopo e limitação

Foram implementados os achados P0, P1 e P2 da auditoria, incluindo registro rápido, foco e acessibilidade, i18n, terminologia, Hoje/Jornada/Mais, Progresso, calculadora, feedback, toolchain Capacitor 8 e carregamento tardio. Não foram adicionados recursos clínicos, dependências de rede ou migrações de storage.

O teste em dispositivo físico **não foi executado por decisão de escopo**. A validação Android desta entrega usa sincronização Capacitor, testes nativos, lint, build e emulador automatizado.

## Mapa de acesso

| Recurso | Destino em 3.9.10 |
| --- | --- |
| Próxima aplicação e registros do dia | Hoje e `+ Registrar` |
| Agenda e próximos sete dias | Jornada > Próximos |
| Histórico, edição, exclusão e registro retroativo | Jornada > Histórico |
| Evolução, gráficos, metas e regularidade | Progresso |
| Peso, sintomas e medidas | `+ Registrar` (modos rápidos e completo) |
| Tratamentos, frascos e locais | Mais > Tratamento |
| Calculadora, pesquisa e relatórios | Mais > Ferramentas |
| Health Connect, backup, importar, exportar e compartilhar | Mais > Dados |
| Notificações, aparência, idioma, acessibilidade, segurança e widget | Mais > App |
| Termos, privacidade, sugestão, diagnósticos e sobre | Mais > Ajuda |

## Commits por área

- `dbede0d` — escolha explícita no registro manual sem pendência.
- `29be32b` — formulário compacto de aplicação e foco.
- `a7bf87d` — Jornada, Mais, Progresso, feedback e superfícies principais.
- `3ab0aac` — Capacitor 8, dependências, Android e CI.
- `4745c8c` — testes E2E da navegação, foco e períodos.
- `d5800cc` — restauração de destinos legados de Mais e binding dinâmico de idioma.
- `e9725c6` — remoção de `nextSite` da Home e badges funcionais com SVG/CSS.
- `6e23b29` — manter o idioma acessível diretamente no menu Mais.
- `277e237` — hidratar Mais fora do caminho inicial e tornar o trap de foco determinístico.
- `a50a39e` — atualizar o snapshot Linux da lista compacta de Mais.
- `639b1f7` — sincronizar lockfile com a versão 3.9.10 e Node mínimo.

O APK foi gerado a partir do commit validado `639b1f7`.

## Validação automatizada

- `npm ci`: aprovado na CI com Node 22.21.1.
- `npm test`: **555/555 testes em 54 arquivos aprovados**.
- `npm run build`: aprovado.
- `npm run test:performance`: aprovado; JavaScript inicial **68.361 bytes gzip (66,8 KiB)**, DOM vazio 806, first content 144 ms, DOM ready 232,9 ms, long task 105 ms, carga DOM 1.025 e primeiro acesso tardio Jornada 8,3 ms, Progresso 42,1 ms e Mais 14,9 ms. O aviso conhecido de import dinâmico de medições permanece documentado; não foi introduzido import cosmético.
- E2E completo: **187 aprovados e 7 cenários condicionais ignorados** (194 cenários) no job Web/E2E da CI, incluindo registro, Jornada, Progresso, Mais, acessibilidade, visual e emulação Galaxy A55.
- Android: `cap sync`, `testDebugUnitTest`, `lintDebug` e `assembleDebug`: aprovados.
- `npm audit --omit=dev`: **0 vulnerabilidades**.
- `npm audit` completo: três ocorrências moderadas transitivas em ferramentas de desenvolvimento (`@capacitor/cli`/`xcode`/`uuid`); não chegam ao runtime publicado e não foram corrigidas com `--force`.

A matriz física permanece excluída conforme o escopo desta versão. Os cenários Galaxy A55 são emulação automatizada de viewport e não substituem teste em aparelho.

## APK de avaliação

Nome: `Protocolo-PEP-v3.9.10.apk`
Commit de origem: `639b1f7`
Bytes: **12.358.600**
SHA-256: `372579B0E518E919822B793693D29AD975086BBBA001FC53C4C87F8B09BEF833`

O APK é uma build debug para avaliação. A ausência de teste em dispositivo físico será repetida nas notas da release pública.

## Release

A tag anotada `v3.9.10` aponta para `639b1f7` e a release pública está disponível em [github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.10](https://github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.10). A CI final [34720044422](https://github.com/lguscouto/protocolopep.github.io/actions/runs/34720044422) terminou verde; o asset hospedado tem 12.358.600 bytes e SHA-256 `sha256:372579b0e518e919822b793693d29ad975086bbba001fc53c4c87f8b09bef833`, igual ao APK local.
