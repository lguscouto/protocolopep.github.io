# Pesquisa visual de mercado — Protocolo PEP

Data da análise: 2 de setembro de 2026.

## Objetivo

Evoluir o Protocolo PEP de uma interface predominantemente utilitária para uma experiência mais acolhedora, visual e memorável, sem perder os princípios que diferenciam o produto: funcionamento local-first, ausência de prescrição e cálculos auditáveis.

## Referências analisadas

| Produto | Força observada | O que aproveitar como princípio | O que não copiar |
| --- | --- | --- | --- |
| [OzemPro](https://apps.apple.com/br/app/ozempro-emagrecer-com-glp-1/id6753301974) | Comunicação muito acessível, mascote, títulos de benefício grandes e telas de progresso com forte apelo emocional | Tornar o valor de cada tela evidente em poucos segundos; usar ilustrações amigáveis no primeiro contato | Panda, roxo dominante, linguagem de transformação e excesso de recursos de coaching/IA |
| [Shotsy](https://shotsyapp.com/pt-BR/) | Registro rápido, cor como orientação, próxima dose em destaque e rotação de locais integrada ao fluxo | Ação primária clara; histórico e “próximo” visíveis; feedback visual celebratório com moderação | Confete como resposta padrão e correlações que possam parecer causalidade clínica |
| [VialBook](https://www.vialbook.com/glp-1-tracker-app) | Visual escuro sóbrio, mapa corporal direto, foco em privacidade e registro local | Mapa com estado temporal, pouco ruído e linguagem factual | Codificação “pronto/não pronto” que possa sugerir avaliação da pele |
| [MyTherapy](https://www.mytherapyapp.com/app-weight-loss-injections) | Fluxo convencional e confiável de lembrete, registro e acompanhamento | Clareza, previsibilidade e poucos passos para registrar | Aparência genérica de prontuário ou dependência de parcerias externas |
| [Glapp](https://apps.apple.com/us/app/glapp-smart-glp-1-tracker/id6756984097) | Relaciona dose, sintomas, estoque e progresso em uma narrativa contínua | Conectar registros em uma linha do tempo compreensível | Comparações com pares ou previsões que extrapolem os dados locais do usuário |

## Padrões recorrentes do mercado

1. A tela inicial responde imediatamente “o que acontece agora?” por meio de próxima dose, contagem regressiva ou tarefa do dia.
2. O registro de aplicação cabe em poucos toques e reaproveita dados já conhecidos.
3. O local da aplicação é visual, não apenas um campo de formulário.
4. Peso, sintomas, dose e local ganham valor quando aparecem na mesma linha do tempo.
5. Privacidade é uma promessa relevante, mas poucos produtos a tornam parte visível da identidade.

## Direção recomendada para o PEP

**Conceito:** “Precisão que acolhe”.

- Manter o turquesa como assinatura e trocar emojis por ilustrações consistentes.
- Usar fundos escuros profundos, superfícies azul-petróleo e pequenos acentos âmbar para histórico/atenção.
- Fazer a tela de registro começar pelo contexto: composto, próximo local na rotação e último local registrado.
- Usar uma barriga desenhada com pontos interativos. O desenho é decorativo; os pontos são botões HTML de 44 × 44 px com `aria-pressed`.
- Tratar o mapa como memória visual, nunca como recomendação clínica. Texto obrigatório: “O mapa apenas registra sua escolha. Ele não avalia a pele nem indica onde aplicar.”
- Manter coxa, deltoide e locais personalizados como alternativas textuais acessíveis.
- Reservar ilustrações raster para onboarding e estados vazios. Ícones, gráficos e elementos interativos continuam vetoriais/code-native.

## Primeira entrega implementada

- Três ilustrações originais, geradas para o projeto e armazenadas localmente no APK.
- Onboarding sem emojis, com arte coerente nos três passos.
- Seletor visual de abdômen no fluxo “Registrar Aplicação”.
- Estados distintos para local selecionado, próximo na rotação e último registrado.
- Fallback completo para os demais locais configurados pelo usuário.

## Segunda entrega implementada — dashboard orientado à próxima ação

- O primeiro elemento útil da tela passou a responder diretamente “o que vem agora?”.
- O hero apresenta o próximo composto pendente por horário, os dados já configurados e um único CTA de registro.
- Ao registrar uma aplicação, o hero avança automaticamente para a próxima pendência do dia.
- Estados sem agenda e rotina concluída mostram a próxima ocorrência futura sem criar urgência clínica.
- O progresso diário permanece visível, mas ocupa uma posição secundária.
- Feedback, ferramentas e criação de protocolo foram preservados abaixo da rotina principal.
- O aviso médico extenso saiu do dashboard e permanece nos contextos em que é necessário: onboarding e calculadora. No dashboard, ficou apenas o lembrete compacto de registro pessoal e armazenamento local.
- Os novos textos estáticos e dinâmicos foram integrados aos idiomas português, inglês e espanhol.

## Terceira entrega implementada — linha do tempo de semana e histórico

- A visão semanal deixou a matriz densa de células e passou a organizar os próximos 7 dias em uma linha do tempo vertical, com marcadores de data, destaque para hoje e cartões de aplicação.
- Cada aplicação mantém o registro por toque, o estado aplicado/pendente, o progresso de protocolos com mais de uma dose e o atalho separado para editar o peptídeo.
- O histórico passou a usar a mesma linguagem visual de trilho, data e conteúdo, preservando exclusão, dose retroativa, local e observações.
- Estados vazios agora explicam o próximo passo sem parecer uma tela quebrada.
- A hierarquia visual continua factual: o componente apenas organiza registros e agenda local; não indica conduta clínica.

## Quarta entrega implementada — estados vazios ilustrados

- Inventário, medidas e pesquisa passaram a usar ilustrações raster compactas, originais e armazenadas localmente no app.
- Cada estado mantém a informação principal em texto, usa `alt` vazio para não duplicar a mensagem e ocupa pouco espaço vertical.
- Inventário e medidas oferecem uma ação direta para iniciar o primeiro registro; a pesquisa orienta a refinar o termo ou filtro.
- Os textos dos estados foram adicionados aos três idiomas suportados, sem dependência de rede ou conteúdo clínico prescritivo.

## Próximas prioridades visuais

1. ~~Redesenhar o dashboard para destacar “próxima ação” e reduzir o peso dos avisos legais repetidos.~~ Concluído.
2. ~~Transformar histórico e semana em uma linha do tempo mais visual.~~ Concluído.
3. ~~Criar estados vazios ilustrados menores para inventário, medidas e pesquisa.~~ Concluído.
4. ~~Padronizar campos hoje definidos com estilos inline em componentes reutilizáveis.~~ Concluído.
5. ~~Preparar screenshots de loja próprios, com linguagem de benefício sem imitar a campanha do OzemPro.~~ Concluído.

## Quinta entrega implementada — campos de formulário reutilizáveis

- Os campos dos modais de edição de peptídeo, registro retroativo, inventário de frascos e medições passaram a compartilhar uma linguagem visual definida em `primitives.css`.
- Labels, controles, grids de data/dose, intervalos de horário, grupos de escolha e chips agora usam classes semânticas, com foco, espaçamento e altura mínima de toque consistentes.
- Os controles dinâmicos de horários extras também reutilizam o mesmo sistema, evitando que novos campos voltem a depender de estilos inline.
- A mudança é exclusivamente visual: IDs, eventos, persistência local e validações existentes foram preservados.

## Sexta entrega implementada — screenshots próprios para loja

- Quatro peças verticais em 1080 × 1920 px foram geradas a partir dos fluxos reais do app: próxima ação, mapa de aplicação, linha do tempo e acompanhamento pessoal.
- A direção usa fundo escuro, turquesa de assinatura, mockup de telefone e mensagens factuais de benefício, sem mascote, roxo dominante ou promessas clínicas.
- Os dados exibidos são sintéticos, as imagens ficam no repositório e o gerador local é reproduzível em `tools/generate-store-screenshots.mjs`.
- A especificação de uso e os textos de cada peça estão em `docs/store-screenshots/README.md`.

## Sétima entrega implementada — ergonomia dos controles compactos

- Ações de dose, edição de medidas, inventário, sítios e limpeza da pesquisa passaram a usar primitivas visuais reutilizáveis, sem estilos inline de dimensão.
- Chips de calculadora, filtros de pesquisa, sintomas, seletores segmentados, dias da semana, idiomas, unidades e cores agora preservam área mínima de toque de 44 × 44 px.
- Ícones e swatches mantêm conteúdo visual compacto dentro da área interativa ampliada, evitando crescimento desnecessário dos elementos.
- A suíte E2E passou a verificar os fluxos compactos nos três perfis de viewport, incluindo a tolerância de subpixel dos navegadores móveis.

## Oitava entrega implementada — componentes de ação e estados de interação

- Ações recorrentes de histórico, calculadora, inventário e ajustes passaram a compartilhar variantes CSS semânticas, reduzindo estilos inline nos controles de maior uso.
- Estados de hover e foco para botões de superfície agora seguem a mesma resposta de borda, fundo e contraste, sem interferir nos estados ativos de idioma ou favorito.
- O atalho de pesquisa da calculadora e o botão de limpar pesquisa foram alinhados à mesma altura mínima dos demais controles.
- Favoritos da pesquisa passaram a expor estado por `aria-pressed` e classe visual, mantendo a cor de atenção como token do tema.
