# Nova experiência PEP — acompanhamento da implementação

Base: `234af84` (3.9.0). Branch: `codex/pep-ux-4-0`.

Entrega de avaliação, sem merge ou release pública. Desfazer exclusões permanece fora do escopo.

## Mapa de acesso

| Recurso anterior | Destino |
| --- | --- |
| Hoje / próxima aplicação | Hoje e + Registrar |
| Agenda | Jornada > Próximos |
| Histórico, correções e exclusões | Jornada > Histórico |
| Evolução, gráficos, metas e aderência | Progresso |
| Peso, sintomas e medidas | + Registrar |
| Cadastro e gestão de protocolos | Mais > Tratamento |
| Frascos e locais | Mais > Tratamento |
| Calculadora, pesquisa e relatórios | Mais > Ferramentas |
| Backup, importar, exportar, compartilhar e Health Connect | Mais > Dados |
| Aparência, idioma, acessibilidade, bloqueio e notificações | Mais > App |
| Onboarding, privacidade, feedback e diagnósticos | Mais > Ajuda |

## Validação por etapa

Os resultados são registrados após execução. Os dados de teste são sintéticos.

### Etapa 0

- Instalação limpa concluída.
- Unitários: 553 testes em 54 arquivos aprovados.
- Build Web: aprovado; a entrada inicial ficou em 87,79 kB gzip, acima do orçamento de 80 kB já excedido pela base (84,84 kB na medição inicial).
- CI habilitada também nas branches `codex/**`.
- Baseline: E2E da base teve 150 aprovados, 7 ignorados e 6 falhas de touch/visual; a medição inicial acusou somente o orçamento de JavaScript gzip.

Não houve atualização de dependências: o diagnóstico do npm na instalação é preexistente a esta refatoração.

### Etapas 1–5

- Medições foram isoladas do carregamento do Histórico, com modos `weight`, `symptom` e `full`, data local e listeners idempotentes.
- `+ Registrar` abre aplicação, peso, sintoma e medidas; trata uma, várias ou nenhuma pendência e reutiliza o formulário/persistência existentes.
- A navegação agora é `Hoje`, `Jornada`, `Progresso` e `Mais`. Jornada mantém os segmentos Próximos/Histórico; Progresso concentra evolução, aderência, metas, medidas e sintomas.
- Hoje mantém uma pendência principal, os demais registros e um resumo compacto de progresso. Mais agrupa Tratamento, Ferramentas, Dados, App e Ajuda.
- Calculadora, onboarding, ícones locais, safe-area e traduções foram atualizados sem dependências de rede ou bibliotecas novas.

### Etapa 6 — validação da implementação

- Unitários: 553/553 aprovados.
- E2E Android pequeno: 56/56 aprovados após a atualização dos contratos de navegação; a matriz visual foi revisada e os snapshots de 360, 412 e 600 px foram atualizados.
- E2E direcionado da nova experiência: 4/4 aprovados; fluxos de rotina e lembretes: 16/16 aprovados.
- Axe no Hoje, Calculadora, Progresso, Mais e Notificações: aprovado nos fluxos exercitados.
- A medição de desempenho completou os cenários de inicialização e acesso tardio, mas falhou na asserção do JavaScript inicial (87.791 bytes contra 81.920). Nenhum limite foi relaxado; os demais valores não foram declarados aprovados sem a saída final da asserção.
- CI final do commit `31b88ce`: Node Test & Web Build aprovado com 169 testes E2E e 7 cenários ignorados; Android Build & Native Tests aprovado com sincronização Capacitor, `testDebugUnitTest`, `lintDebug` e `assembleDebug`.
- Os snapshots de referência foram atualizados nos ambientes Windows e Linux. O cenário Galaxy A55 usa a navegação atual de Mais > Tratamento e o fluxo de teclado passou localmente e na CI.

## APK de avaliação

Arquivo gerado a partir do commit `31b88ce3481d7044e2e7077306d6fd04dedbbfe8`:

`Protocolo-PEP-UX4-0-31b88ce.apk` — 12.239.206 bytes  
SHA-256: `5639059C74E55A46925BBC816D90577A896D8742FE24D653A37D04F3B687A505`

O APK é uma build debug para avaliação. Não houve validação em aparelho físico nem publicação pública nesta entrega.
