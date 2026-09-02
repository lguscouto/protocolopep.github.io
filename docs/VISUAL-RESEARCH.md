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

## Próximas prioridades visuais

1. ~~Redesenhar o dashboard para destacar “próxima ação” e reduzir o peso dos avisos legais repetidos.~~ Concluído.
2. Transformar histórico e semana em uma linha do tempo mais visual.
3. Criar estados vazios ilustrados menores para inventário, medidas e pesquisa.
4. Padronizar campos hoje definidos com estilos inline em componentes reutilizáveis.
5. Preparar screenshots de loja próprios, com linguagem de benefício sem imitar a campanha do OzemPro.
