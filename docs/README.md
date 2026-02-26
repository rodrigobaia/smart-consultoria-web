# POC — Smart Consultoria System (HTML/CSS/JS)

Esta POC existe para **validar o fluxo** (UX + passos) antes do desenvolvimento em Blazor.

## Como executar
1. Abra o arquivo `poc/index.html` no navegador (Chrome/Edge).
2. Faça login (simulado) e selecione um perfil (role).
3. Acesse **Importação** (aparece para **Administrador** e **Gestor**).
4. Selecione os arquivos:
   - `docs/Vendas.csv`
   - `docs/Itens.csv`
5. Clique em **Processar**.

> Observação: estes CSVs podem ter encoding legado (ex.: Windows-1252/ISO-8859-1). Se você visualizar caracteres “quebrados”, altere o campo **Encoding** e processe novamente.

## Estrutura (multi-página)
Cada item do menu possui um HTML próprio:
- `poc/login.html`
- `poc/home.html`
- `poc/importacao.html`
- `poc/propostas.html`
- Cadastros:
  - `poc/cad-lojas.html`
  - `poc/cad-usuarios.html`
  - `poc/cad-colaboradores.html`
  - `poc/cad-produtos.html`
  - `poc/cad-bancos.html`
- Configuração:
  - `poc/configuracao.html`

Arquivos compartilhados:
- `poc/styles.css`
- `poc/poc.js` (layout, sessão, helpers)
- `poc/store.js` (persistência local para CRUD mock)
- `poc/crud-page.js` (render genérico de CRUD)
- `poc/importacao.js` / `poc/propostas.js` (lógica de cada tela)

## O que a POC valida
- Login e **menus por perfil** (simulado)
- Fluxo de importação (upload no browser)
- “Staging view”: contagem de linhas + erros/pendências
- Cruzamento `Vendas` x `Itens` por **Código da Proposta**
- Navegação por lista de propostas e detalhe com itens

## O que a POC NÃO valida (ainda)
- Mapeamento completo de todas as colunas dos CSVs (será documentado depois)
- Fórmulas finais de comissão/cálculos e regras de validação por coluna (será definido depois)

## Documentação Adicional
- [Diretrizes de UI/UX e Responsividade](./UI_GUIDELINES.md) — Recomendações para a implementação final em Blazor.
- [Guia de Migração Técnica para Blazor](./BLAZOR_MIGRATION_GUIDE.md) — Detalhes da arquitetura da POC para desenvolvedores.


