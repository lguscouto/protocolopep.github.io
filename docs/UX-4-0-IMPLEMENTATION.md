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
- Unitários: 545 testes em 51 arquivos aprovados.
- Build Web: aprovado; entrada inicial 84,84 kB gzip no relatório Vite.
- CI habilitada também nas branches `codex/**`.
- E2E e medição de desempenho: em execução.

Não houve atualização de dependências: o diagnóstico do npm na instalação é preexistente a esta refatoração.
