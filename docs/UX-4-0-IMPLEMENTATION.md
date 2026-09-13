# Protocolo PEP 3.9.11 — fechamento da auditoria UI/UX

Entrega de avaliação na branch `codex/pep-audit-3-9-11`, criada a partir da `main` já integrada com a 3.9.10. A implementação preserva o funcionamento Local-First/offline, os formatos de dados e os recursos avançados. A 3.9.10 foi integrada em `main` antes desta rodada; esta documentação mantém uma referência única ao APK oficial de cada release.

## Escopo e limitação

Foram consolidados os achados P1 e P2 desta auditoria, incluindo integridade de idiomas, navegação isolada em Mais, metadados dinâmicos, medições de performance com fixture, SVGs locais e migração de estilos inline nas superfícies tocadas. A base 3.9.10 já contém o registro rápido, foco e acessibilidade, Hoje/Jornada/Mais, Progresso, calculadora, feedback, toolchain Capacitor 8 e carregamento tardio. Não foram adicionados recursos clínicos, dependências de rede ou migrações de storage.

O teste em dispositivo físico **não foi executado por decisão de escopo**. A validação Android desta entrega usa sincronização Capacitor, testes nativos, lint, build e emulador automatizado.

## Mapa de acesso

| Recurso | Destino em 3.9.11 |
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

- `dce4b7d` — fechar chaves e textos da evolução em três idiomas.
- `621f382` — consolidar menu Mais e orçamento de carga.
- `0681f87` — localizar superfícies restantes e status do Health Connect.
- `d936923` — remover estilos inline das superfícies auditadas e ajustar E2E à navegação por painel.

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
- `npm test`: **557/557 testes em 54 arquivos aprovados**.
- `npm run build`: aprovado.
- `npm run test:performance`: aprovado; JavaScript inicial **67.942 bytes gzip (66,3 KiB)**. Medianas da fixture vazia: DOM ready 296,2 ms, first content 184 ms, long tasks 154 ms e 812 nós. Medianas da fixture carregada: DOM ready 2.460,6 ms, first content 200 ms, long tasks 2.421 ms e 1.031 nós; primeiro acesso tardio Jornada 8,8 ms, Progresso 62,5 ms e Mais 14,9 ms. O aviso conhecido de import dinâmico de medições permanece documentado; não foi introduzido import cosmético.
- A baseline carregada fixa limites de regressão de 20% para tempos, 25% para tarefas longas e 5% para nós DOM, com teto de 80 KiB gzip e limites do cenário vazio preservados.
- E2E completo: **187 aprovados e 7 cenários condicionais ignorados** (194 cenários) no job Web/E2E da CI, incluindo registro, Jornada, Progresso, Mais, acessibilidade, visual e emulação Galaxy A55.
- Android: `cap sync`, `testDebugUnitTest`, `lintDebug` e `assembleDebug`: aprovados.
- `npm audit --omit=dev`: **0 vulnerabilidades**.
- `npm audit` completo: três ocorrências moderadas transitivas em ferramentas de desenvolvimento (`@capacitor/cli`/`xcode`/`uuid`); não chegam ao runtime publicado e não foram corrigidas com `--force`.

A matriz física permanece excluída conforme o escopo desta versão. Os cenários Galaxy A55 são emulação automatizada de viewport e não substituem teste em aparelho.

## APK de avaliação da 3.9.10

Nome: `Protocolo-PEP-v3.9.10.apk`
Commit de origem: `639b1f7`
Bytes: **12.358.600**
SHA-256: `372579B0E518E919822B793693D29AD975086BBBA001FC53C4C87F8B09BEF833`

O APK é uma build debug para avaliação. A ausência de teste em dispositivo físico será repetida nas notas da release pública.

## Release

A tag anotada `v3.9.10` aponta para `639b1f7` e a release pública está disponível em [github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.10](https://github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.10). A CI final [34720044422](https://github.com/lguscouto/protocolopep.github.io/actions/runs/34720044422) terminou verde; o asset hospedado tem 12.358.600 bytes e SHA-256 `sha256:372579b0e518e919822b793693d29ad975086bbba001fc53c4c87f8b09bef833`, igual ao APK local.

## Roteiro de smoke físico (execução posterior)

Este roteiro fica documentado para uma rodada futura e não é gate da 3.9.11: instalar o APK debug, atualizar a partir da 3.9.10, abrir Hoje/Jornada/Progresso/Mais, registrar uma aplicação e uma medição, confirmar notificações e ações, testar widget, bloqueio biométrico, Health Connect, exportação/importação de arquivos e haptic, e verificar retomada, Voltar, rotação e teclado. **Teste em dispositivo físico: não executado por decisão de escopo.**

## Registro da 3.9.11

Commit validado do código e origem do APK: `a06e694` (integrado em `main` por fast-forward).

APK: `Protocolo-PEP-v3.9.11.apk` (build debug de avaliação).

Bytes: **12.309.306**.

SHA-256 local: `A55B4A6BE2128D637C6A81B8808D8657F5962A0980F0D3D39568D7CADD46F239`.

CI da branch validada: [34735315202](https://github.com/lguscouto/protocolopep.github.io/actions/runs/34735315202). CI do commit integrado em `main`: [34735685318](https://github.com/lguscouto/protocolopep.github.io/actions/runs/34735685318).

Release pública: [github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.11](https://github.com/lguscouto/protocolopep.github.io/releases/tag/v3.9.11). O digest do asset hospedado será conferido contra o SHA-256 local antes da entrega.
