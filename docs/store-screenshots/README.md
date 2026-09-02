# Screenshots de loja — Protocolo PEP

Conjunto inicial de quatro peças verticais para apresentação do app em lojas e materiais próprios.

## Peças

| Arquivo | Mensagem principal | Fluxo mostrado |
| --- | --- | --- |
| `01-proxima-acao.png` | A próxima ação fica clara. | Dashboard com próxima ação e CTA de registro |
| `02-mapa-de-aplicacao.png` | Registre o local com clareza. | Mapa visual do local de aplicação |
| `03-linha-do-tempo.png` | Sua semana, em uma linha do tempo. | Visão semanal com estados aplicado/pendente |
| `04-acompanhamento-pessoal.png` | Acompanhe no seu ritmo. | Registro de medidas, energia, humor e observações |

Todas as imagens têm 1080 × 1920 px, proporção vertical 9:16 e usam somente conteúdo local do app. Os dados exibidos são sintéticos e servem apenas para apresentação visual.

## Regenerar

Com o servidor Vite rodando em `http://127.0.0.1:3000/`:

```bash
node tools/generate-store-screenshots.mjs
```

O gerador abre os fluxos reais em um navegador local, aplica uma moldura editorial própria e salva os PNGs nesta pasta. Não há chamadas de rede nem dependência de dados pessoais.
