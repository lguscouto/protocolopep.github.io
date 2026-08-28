# Protocolo PEP — Contrato do Produto

## 1. Visão Geral
O **Protocolo PEP** é um aplicativo Android nativo, offline e **100% Local-First**, desenvolvido para acompanhamento pessoal, organização e cálculo de reconstituição de peptídeos.

> [!IMPORTANT]
> **Aviso Médico & Não Prescrição:**
> O Protocolo PEP é estritamente uma ferramenta de registro pessoal e cálculo matemático. O aplicativo **não** prescreve, recomenda, diagnostica, trata ou indica dosagens, substâncias ou protocolos médicos. Qualquer dado inserido no aplicativo é de inteira responsabilidade do usuário.

---

## 2. Público-Alvo e Casos de Uso
- **Pessoas em acompanhamento com profissionais de saúde** que utilizam compostos e peptídeos e necessitam de uma ferramenta confiável para registrar suas aplicações e horários.
- **Indivíduos que precisam calcular diluição e unidades de seringa U-100** com precisão matemática auditável.

---

## 3. Pilares do Produto
1. **Local-First & Privacidade Absoluta:**
   - Todos os dados residem exclusivamente no armazenamento do dispositivo (`localStorage` / Preferences).
   - Não requer criação de conta, login ou conexão à internet.
   - Nenhum dado é enviado para servidores de terceiros ou nuvem não solicitada.
2. **Confiabilidade Matemática:**
   - A calculadora utiliza grandezas canônicas (microgramas e mililitros), impedindo anomalias de conversão.
   - As fórmulas e etapas de cálculo são transparentes e auditáveis.
3. **Agenda Unificada:**
   - Um único motor de regras puras determina quais aplicações são devidas no dia ("Hoje"), na grade ("Semana"), no histórico e nos alarmes nativos.

---

## 4. Limites e Exclusões de Escopo
- Sem prescrição automática ou sugestão de dosagens.
- Sem integração com telemedicina ou venda de insumos.
- Sem inteligência artificial preditiva que interfira nas decisões clínicas do usuário.
- Sem rastreamento de localização ou telemetria invasiva.
