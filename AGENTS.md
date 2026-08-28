# Diretrizes de Engenharia e Governança — Protocolo PEP

Este documento orienta agentes de IA e desenvolvedores que trabalham na evolução do código do Protocolo PEP.

## 1. Princípios Inegociáveis
1. **Local-First & Offline First:** Nunca introduzir dependências de rede obrigatórias no core do app (`fetch`, chamadas a APIs de terceiros não autorizadas). O app deve operar 100% desconectado.
2. **Segurança Matemática:** Qualquer cálculo de dosagem ou reconstituição deve ser puro, auditável e conter testes cobrindo valores limítrofes, zero, NaN e grandezas canônicas.
3. **Não Prescrição:** Nunca inserir dosagens terapêuticas como padrão recomendado em fluxos iniciais. O primeiro acesso deve ser um protocolo limpo.
4. **Resiliência e Fail-Closed:** Nenhuma operação de escrita deve emitir feedback de sucesso (haptic ou toast) sem confirmação prévia de persistência no storage.

## 2. Padrões de Código
- Código modular em `src/domain/` (lógica pura e sem dependência do DOM), `src/services/` (interação com plugins nativos e storage) e `src/ui/` (manipulação segura do DOM).
- Testes unitários com `vitest` para todas as regras de negócio em `src/domain/`.
- Prevenção contra injeção de HTML: nunca interpolar dados de usuário diretamente em strings HTML sem sanitização estrita.
