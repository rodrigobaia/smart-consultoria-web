# Diretrizes de UI/UX e Responsividade

Este documento define os padrões visuais e as estratégias de responsividade para o **Smart Consultoria System**, servindo de base para a transição da POC para o ambiente **Blazor**.

## 1. Princípios de Design
A aplicação deve seguir uma estética **Premium e Moderna**, focada em:
- **Dark Mode Nativo**: Fundo escuro com gradientes sutis e cores vibrantes para destaque (Azul Primário e Verde OK).
- **Glassmorphism**: Uso de `backdrop-filter: blur()` em barras de navegação e modais para profundidade.
- **Micro-interações**: Hover effects suaves em botões e cards para feedback imediato ao usuário.

## 2. Estratégia de Responsividade
Para evitar problemas de layout e aproveitar monitores grandes (UltraWide/4K):
- **Unidades Relativas**: Priorizar `%`, `vw`, `vh`, `rem` e `em` em vez de pixels fixos.
- **Containers Fluídos**: O container principal deve ser expansível (ex: `max-width: 1600px` ou `100%`) para evitar desperdício de espaço lateral.
- **CSS Grid e Flexbox**: Usar nativamente para layouts complexos que se reorganizam automaticamente em telas menores.

## 3. Recomendações para Blazor
Na implementação final em Blazor, recomendamos o uso de ferramentas que facilitem essa modernidade:

### 🚀 MudBlazor (Recomendado)
Biblioteca de componentes baseada em Material Design que abstrai toda a complexidade do grid responsivo.
- **Uso**: `<MudGrid>`, `<MudItem xs="12" md="6">`.
- **Vantagem**: Ideal para sistemas densos de dados e dashboards.

### 🎨 Tailwind CSS
Para controle total sobre o design sem as limitações de frameworks de componentes.
- **Uso**: Classes utilitárias como `flex`, `grid-cols-4`, `p-8`.
- **Vantagem**: Facilita a criação de interfaces exclusivas e extremamente leves.

### 🏢 Fluent UI (Microsoft)
Caso o objetivo seja integração visual total com o ecossistema Windows/Office 365.

---

*Estas diretrizes visam garantir que o sistema não apenas funcione bem, mas também proporcione uma experiência visual de alto nível para o usuário final.*
