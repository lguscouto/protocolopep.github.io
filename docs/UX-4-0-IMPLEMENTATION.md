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

O APK foi gerado a partir do commit de implementação `6e23b29`.

## Validação automatizada

- `npm ci`: aprovado.
- `npm test`: **555/555 testes em 54 arquivos aprovados**.
- `npm run build`: aprovado.
- `npm run test:performance`: aprovado; JavaScript inicial **67.722 bytes gzip (66,1 KiB)**, DOM vazio 806, first content 196 ms, DOM ready 310,6 ms, long task 159 ms, e primeiro acesso tardio Jornada 9,3 ms, Progresso 63 ms e Mais 83,3 ms. O aviso conhecido de import dinâmico de medições permanece documentado; não foi introduzido import cosmético.
- E2E direcionado `tests/e2e/ux-4-0.spec.js`: **30/30** nos projetos `android-small`, `android-standard` e `wide-mobile`.
- E2E de compatibilidade da organização de Mais: aprovado no projeto `android-small`.
- Android: `cap sync`, `testDebugUnitTest`, `lintDebug` e `assembleDebug`: aprovados.
- `npm audit --omit=dev`: **0 vulnerabilidades**.
- `npm audit` completo: três ocorrências moderadas transitivas em ferramentas de desenvolvimento (`@capacitor/cli`/`xcode`/`uuid`); não chegam ao runtime publicado e não foram corrigidas com `--force`.

A matriz física permanece excluída conforme o escopo desta versão. A execução completa da matriz E2E legada mantém os cenários históricos de touch/visual já identificados na base; os fluxos novos e afetados possuem cobertura direcionada acima.

## APK de avaliação

Nome: `Protocolo-PEP-v3.9.10.apk`
Commit de origem: `6e23b29`
Bytes: **12.358.058**
SHA-256: `ACD0632F996176904888E0067B95C8F8B157204A4EE662924CFD349511CCF58F`

O APK é uma build debug para avaliação. A ausência de teste em dispositivo físico será repetida nas notas da release pública.

## Release

A tag anotada e a release pública `v3.9.10` serão criadas somente depois da validação final, do sucesso dos jobs Web/E2E/Performance/Android na CI e da conferência do SHA-256 do asset hospedado contra o arquivo local.
