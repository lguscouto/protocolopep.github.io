# Protocolo PEP — Sistema de Design (Design System)

**Conceito Central:** *"Precisão privada para a rotina de hoje."*

## 1. Princípios Visuais
- **Científico e Confiável:** Cores equilibradas inspiradas em precisão laboratorial com foco em calmaria e sobriedade.
- **Acessibilidade Inegociável:** Contraste WCAG 2.1 AA mínimo de 4.5:1 para todo texto legível, e 3:1 para elementos gráficos e contornos essenciais.
- **Toque Ergonômico:** Alvo de toque mínimo (`--tap-min`) de 44×44 px em todos os controles interativos (botões, células, ícones de ação) e 48 px na navegação primária.
- **OLED / Dark-First com Tema Claro de Alto Padrão:** Fundo escuro profundo (`#070B10`) com superfícies em camadas e suporte completo ao tema claro (`#F5F7F8`).

## 2. Paleta de Cores e Contraste

### Tema Escuro (Padrão)
- **Fundo Principal (`--bg`):** `#070B10`
- **Superfície 1 (`--surface`):** `#101821`
- **Superfície 2 (`--surface-2`):** `#172330`
- **Superfície 3 (`--surface-3`):** `#203040`
- **Texto Principal (`--text`):** `#F1F5F9` *(Contraste 17.5:1)*
- **Texto Secundário (`--muted`):** `#A7B3C2` *(Contraste 9.27:1)*
- **Texto Muted-2 (`--muted-2`):** `#8A98A8` *(Contraste 6.71:1)*
- **Destaque Primário (`--primary`):** `#30D5C8` / Primário Forte: `#1FAEA4`
- **Sucesso (`--success`):** `#35D09F`
- **Alerta (`--warning`):** `#F5B75B`
- **Perigo (`--danger`):** `#FF6B7A`

### Tema Claro
- **Fundo Principal (`--bg`):** `#F5F7F8`
- **Superfície 1 (`--surface`):** `#FFFFFF`
- **Superfície 2 (`--surface-2`):** `#EDF2F4`
- **Superfície 3 (`--surface-3`):** `#E3EAEE`
- **Texto Principal (`--text`):** `#14202A` *(Contraste 13.9:1)*
- **Texto Secundário (`--muted`):** `#526474` *(Contraste 5.69:1)*
- **Texto Muted-2 (`--muted-2`):** `#5F7080` *(Contraste 4.75:1)*
- **Destaque Primário (`--primary`):** `#0F766E` *(Contraste 5.47:1 sobre branco)*

## 3. Escala Espacial e Raios
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `24px`
- `--space-6`: `32px`
- `--radius-sm`: `10px`
- `--radius-md`: `14px`
- `--radius-lg`: `18px`
- `--radius-xl`: `24px`
- `--tap-min`: `44px`

## 4. Tipografia
- **Corpo:** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Títulos:** `'Space Grotesk', system-ui, sans-serif`
- **Tamanhos Recomendados:**
  - Título Principal (Page Title): `22px` - `24px` (Peso 700)
  - Título de Seção: `16px` - `18px` (Peso 600)
  - Corpo Normal: `14px` - `15px` (Peso 400/500)
  - Metadados / Legendas: `12.5px` - `13px` (com contraste reforçado ≥ 4.5:1)
