# Guia de Migração: POC para Blazor Server

Este documento detalha a arquitetura técnica da POC e como ela deve ser traduzida para o **Blazor Server**. Ele serve como base de conhecimento para a IA ou desenvolvedor que realizará a implementação final.

## 1. Arquitetura de UI e Componentes

A estrutura visual da POC definida no `poc.js` (método `renderShell`) e `styles.css` mapeia diretamente para os seguintes componentes Blazor:

### 1.1 Layout (MainLayout.razor)
- **TopBar**: Componente contendo o título do sistema, seletor de tema e menu do usuário.
- **NavMenu**: Barra lateral (`aside#nav`) que usa `display: flex` para empurrar o rodapé da versão para o fim.
- **Footer**: O rodapé principal contendo informações de build e versão.

### 1.2 Componentes Compartilhados (.razor)
- **SmartCard**: Baseado na classe `.card`.
- **SmartButton**: Encapsulando estilos `.btn`, `.btn--primary` e `.btn--ghost`.
- **SmartModal**: Implementação C# para o sistema de modais (atualmente `showModal` no JS).
- **SmartToast**: Serviço de notificação baseado no `.toast` do CSS.

## 2. Gestão de Estado e Lógica de Negócio

### 2.1 Autenticação e Perfis (Roles)
- **POC**: Usa `localStorage` (`poc_session_v1`) e o atributo `data-roles` nos links do menu.
- **Blazor**: Deve usar `CustomAuthenticationStateProvider` e o sistema de `AuthorizeView` do ASP.NET Core Identity.
- **Roles**: Administrador, Gestor, Consultor, Operador.

### 2.2 Persistência de Dados
- **POC**: Usa `store.js` e `localStorage`.
- **Blazor**: Implementar repositórios C# usando **Entity Framework Core**.
- **Seed**: A lógica de `Poc.seed()` deve ser migrada para um `DataSeeder` no C# para popular tabelas iniciais (Produtos e Matriz de Comissão).

## 3. Módulos Funcionais

### 3.1 Importação (CSV)
- **Lógica**: A lógica em `importacao.js` que processa arquivos `Vendas.csv` e `Itens.csv` no navegador deve ser movida para o backend.
- **Ferramenta**: Usar **CsvHelper**.
- **Fluxo**: Staging area (tabelas temporárias) -> Validação -> Processamento final.

### 3.2 Propostas e Comissões
- **Cruzamento**: Identificar propostas entre os dois arquivos pelo campo "Código da Proposta".
- **Matriz de Comissão**: Estrutura dinâmica onde cada produto tem valores/porcentagens por perfil. 
- **Desafio**: No Blazor, a matriz deve ser gerenciada como uma tabela de configuração no banco de dados.

## 4. Design System (CSS)
O arquivo `styles.css` já possui variáveis CSS (`:root`) que facilitam a migração:
- **Temas**: O sistema de `data-theme="dark"` deve ser mantido ou integrado ao sistema de temas do MudBlazor/Tailwind.
- **Aesthetics**: Manter o uso de Glassmorphism, gradientes e micro-animações como definido no [UI_GUIDELINES.md](./UI_GUIDELINES.md).

## 5. Histórico de Versão
- **Versão Atual**: 1.0.0 - Release 1
- **Localização**: Rodapé do menu (`.nav__footer`).
