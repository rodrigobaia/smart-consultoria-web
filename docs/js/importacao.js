/* Importação (POC) — lê Vendas/Itens (CSV) e Totalseg (Excel) no browser, faz staging e cruza por
 * Código da Proposta. Persistência: localStorage via Poc.saveImport() / Poc.mergeImport().
 * Depende da lib SheetJS (xlsx) para leitura de Excel.
 */

const PocImportacao = (() => {
  // ---------------------------------------------------------------------------
  // Utilidades de parse
  // ---------------------------------------------------------------------------

  function parseCsvSemicolon(text) {
    const lines = String(text ?? "")
      .replaceAll("\r\n", "\n")
      .replaceAll("\r", "\n")
      .split("\n")
      .map((x) => x.trimEnd())
      .filter((x) => x.length > 0);

    if (lines.length === 0) return { header: [], rows: [] };
    const header = lines[0].split(";").map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) rows.push(lines[i].split(";"));
    return { header, rows };
  }

  /** Lê um arquivo Excel (.xlsx/.xls) e retorna { header, rows } no mesmo formato do CSV. */
  function parseExcel(arrayBuffer) {
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    // Converte a planilha para array de arrays (sem cabeçalho separado ainda)
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!data || data.length === 0) return { header: [], rows: [] };
    const header = data[0].map((h) => String(h ?? "").trim());
    const rows = data.slice(1).map((row) => row.map((c) => String(c ?? "")));
    return { header, rows };
  }

  function findColumnIndex(header, candidates) {
    const normHeader = header.map(Poc.normalizeHeader);
    for (const cand of candidates) {
      const idx = normHeader.findIndex((h) => h === cand || h.includes(cand));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  // ---------------------------------------------------------------------------
  // Leitores de arquivo
  // ---------------------------------------------------------------------------

  async function readFileAsText(file, encoding) {
    if (!file) return "";
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
      try {
        reader.readAsText(file, encoding);
      } catch {
        reader.readAsText(file);
      }
    });
  }

  async function readFileAsArrayBuffer(file) {
    if (!file) return null;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
      reader.readAsArrayBuffer(file);
    });
  }

  // ---------------------------------------------------------------------------
  // Staging genérico (CSV)
  // ---------------------------------------------------------------------------

  function buildStagingRows({ header, rows }, kind) {
    const idxCodigo = findColumnIndex(header, ["cod da proposta", "c d da proposta", "codigo da proposta"]);
    const idxChassi = findColumnIndex(header, ["chassi"]);
    const result = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i];
      const codigo = idxCodigo >= 0 ? Poc.safeStr(cols[idxCodigo]) : null;
      const chassi = idxChassi >= 0 ? Poc.safeStr(cols[idxChassi]) : null;
      const rowNum = i + 2;

      if (!codigo) {
        errors.push({ kind, line: rowNum, message: "Código da Proposta ausente (necessário para cruzamento)." });
      }
      result.push({ kind, line: rowNum, codigoProposta: codigo, chassi, cols });
    }

    return { staging: result, errors, header };
  }

  // ---------------------------------------------------------------------------
  // Staging do Totalseg (Excel)
  // ---------------------------------------------------------------------------

  /**
   * Constrói o staging do Totalseg a partir do Excel parseado.
   * Extrai campos relevantes: Código da Proposta, Produto, Valor Seguro, etc.
   */
  function buildTotalsegStaging({ header, rows }) {
    const idxCodigo = findColumnIndex(header, [
      "cod da proposta", "codigo da proposta", "proposta", "num proposta", "numero proposta"
    ]);
    const idxProduto = findColumnIndex(header, ["produto", "descricao produto", "tipo produto"]);
    const idxValor = findColumnIndex(header, ["valor seguro", "valor premio", "premio", "valor"]);
    const idxStatus = findColumnIndex(header, ["status", "situacao"]);
    const idxCpf = findColumnIndex(header, ["cpf", "cpf cliente"]);
    const idxNome = findColumnIndex(header, ["nome", "nome cliente", "segurado"]);

    const result = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i];
      // Ignora linhas completamente vazias
      if (cols.every(c => !String(c ?? "").trim())) continue;

      const codigo = idxCodigo >= 0 ? Poc.safeStr(cols[idxCodigo]) : null;
      const rowNum = i + 2;

      if (!codigo) {
        errors.push({ kind: "Totalseg", line: rowNum, message: "Código da Proposta ausente." });
      }

      result.push({
        kind: "Totalseg",
        line: rowNum,
        codigoProposta: codigo,
        produto: idxProduto >= 0 ? Poc.safeStr(cols[idxProduto]) : null,
        valorSeguro: idxValor >= 0 ? Poc.parsePtBrNumber(cols[idxValor]) : null,
        status: idxStatus >= 0 ? Poc.safeStr(cols[idxStatus]) : null,
        cpf: idxCpf >= 0 ? Poc.safeStr(cols[idxCpf]) : null,
        nomeCliente: idxNome >= 0 ? Poc.safeStr(cols[idxNome]) : null,
        cols,
      });
    }

    return { staging: result, errors, header };
  }

  // ---------------------------------------------------------------------------
  // Normalização / cruzamento
  // ---------------------------------------------------------------------------

  function normalizeFromVendas(vendasStagingInfo) {
    const { header, staging } = vendasStagingInfo;
    const idxCodigo = findColumnIndex(header, ["cod da proposta", "codigo da proposta"]);
    const idxLoja = findColumnIndex(header, ["loja", "nome fantasia"]);
    const idxCnpjLoja = findColumnIndex(header, ["cnpj loja", "cnpj"]);
    const idxBanco = findColumnIndex(header, ["banco"]);
    const idxValorFin = findColumnIndex(header, ["valor financiado", "valor bruto"]);
    const idxStatus = findColumnIndex(header, ["situacao", "status"]);
    const idxData = findColumnIndex(header, ["data", "data da proposta"]);
    const idxVendedor = findColumnIndex(header, ["vendedor", "colaborador", "consultor"]);
    const idxComissao = findColumnIndex(header, ["valor comissao", "comissao"]);

    const propostasByCodigo = new Map();
    for (const r of staging) {
      const codigo = idxCodigo >= 0 ? Poc.safeStr(r.cols[idxCodigo]) : r.codigoProposta;
      if (!codigo) continue;
      if (propostasByCodigo.has(codigo)) continue;
      propostasByCodigo.set(codigo, {
        codigoProposta: codigo,
        loja: idxLoja >= 0 ? Poc.safeStr(r.cols[idxLoja]) : null,
        cnpjLoja: idxCnpjLoja >= 0 ? Poc.safeStr(r.cols[idxCnpjLoja]) : null,
        banco: idxBanco >= 0 ? Poc.safeStr(r.cols[idxBanco]) : null,
        valorFinanciado: idxValorFin >= 0 ? Poc.safeStr(r.cols[idxValorFin]) : null,
        status: idxStatus >= 0 ? Poc.safeStr(r.cols[idxStatus]) : null,
        data: idxData >= 0 ? Poc.safeStr(r.cols[idxData]) : null,
        vendedorResponsavel: idxVendedor >= 0 ? Poc.safeStr(r.cols[idxVendedor]) : null,
        valorComissao: idxComissao >= 0 ? Poc.safeStr(r.cols[idxComissao]) : "R$ 0,00",
        itens: [],
        seguros: [],  // dados do Totalseg
      });
    }
    return propostasByCodigo;
  }

  function attachItensToPropostas(itensStagingInfo, propostasByCodigo) {
    const { header, staging } = itensStagingInfo;
    const idxCodigo = findColumnIndex(header, ["cod da proposta", "codigo da proposta"]);
    const idxTipo = findColumnIndex(header, ["tipo"]);
    const idxCodItem = findColumnIndex(header, ["codigo"]);
    const idxFornecedor = findColumnIndex(header, ["fornecedor"]);
    const idxDesc = findColumnIndex(header, ["descricao"]);
    const idxQtd = findColumnIndex(header, ["quantidade"]);
    const idxVlrUnit = findColumnIndex(header, ["valor unitario"]);
    const idxCortesia = findColumnIndex(header, ["cortesia"]);

    const pending = [];
    for (const r of staging) {
      const codigo = idxCodigo >= 0 ? Poc.safeStr(r.cols[idxCodigo]) : r.codigoProposta;
      if (!codigo) continue;

      const item = {
        codigoProposta: codigo,
        tipo: idxTipo >= 0 ? Poc.safeStr(r.cols[idxTipo]) : null,
        codigoItem: idxCodItem >= 0 ? Poc.safeStr(r.cols[idxCodItem]) : null,
        fornecedor: idxFornecedor >= 0 ? Poc.safeStr(r.cols[idxFornecedor]) : null,
        descricao: idxDesc >= 0 ? Poc.safeStr(r.cols[idxDesc]) : null,
        quantidade: idxQtd >= 0 ? Poc.parsePtBrNumber(r.cols[idxQtd]) : null,
        valorUnitario: idxVlrUnit >= 0 ? Poc.parsePtBrNumber(r.cols[idxVlrUnit]) : null,
        cortesia: idxCortesia >= 0 ? String(r.cols[idxCortesia] ?? "").trim().toLowerCase() === "s" : false,
        line: r.line,
      };

      const prop = propostasByCodigo.get(codigo);
      if (!prop) {
        pending.push({ kind: "Itens", line: r.line, codigoProposta: codigo, message: "Item sem Venda correspondente no mesmo lote (pendente)." });
        continue;
      }
      prop.itens.push(item);
    }
    return pending;
  }

  /** Cruza registros do Totalseg com as propostas pelo código. */
  function attachTotalsegToPropostas(totalsegStagingInfo, propostasByCodigo) {
    const { staging } = totalsegStagingInfo;
    const pending = [];

    for (const r of staging) {
      const codigo = r.codigoProposta;
      if (!codigo) continue;

      const seguro = {
        codigoProposta: codigo,
        produto: r.produto,
        valorSeguro: r.valorSeguro,
        status: r.status,
        cpf: r.cpf,
        nomeCliente: r.nomeCliente,
        line: r.line,
      };

      const prop = propostasByCodigo.get(codigo);
      if (!prop) {
        pending.push({ kind: "Totalseg", line: r.line, codigoProposta: codigo, message: "Registro Totalseg sem Venda correspondente." });
        continue;
      }
      prop.seguros.push(seguro);
    }
    return pending;
  }

  // ---------------------------------------------------------------------------
  // Renderização de UI
  // ---------------------------------------------------------------------------

  function renderSummary(data) {
    const el = document.getElementById("importSummary");
    el.classList.remove("card--hidden");
    const errors = data.errors.length;
    const pending = data.pending.length;
    const totalsegsCount = data.totalsegRaw?.length ?? 0;
    const lastKey = Poc.getLastBatchKey();
    const batches = Poc.loadBatches();
    const batch = lastKey ? batches.find((b) => b.competenciaKey === lastKey) : null;
    const competenciaBadge = batch
      ? `<span class="badge badge--ok">Competência do lote: <strong>${Poc.escapeHtml(batch.competenciaLabel)}</strong></span>`
      : "";
    const ila = data.percentualIla;
    const ilaBadge = (ila !== undefined && ila !== null && ila !== "")
      ? `<span class="badge badge--ok">ILA do mês: <strong>${typeof ila === "number" ? ila.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : Poc.escapeHtml(String(ila))}%</strong></span>`
      : "";
    el.innerHTML = `
      <h2 style="margin:0 0 10px 0; font-size:16px;">Resumo do lote (POC)</h2>
      <div class="badges" style="margin-bottom:10px;">${competenciaBadge}${ilaBadge}</div>
      <div class="kpi">
        <div class="kpiCard"><div class="kpiCard__label">Linhas Vendas</div><div class="kpiCard__value">${data.vendasRaw.length}</div></div>
        <div class="kpiCard"><div class="kpiCard__label">Linhas Itens</div><div class="kpiCard__value">${data.itensRaw.length}</div></div>
        <div class="kpiCard"><div class="kpiCard__label">Linhas Totalseg</div><div class="kpiCard__value">${totalsegsCount}</div></div>
        <div class="kpiCard"><div class="kpiCard__label">Erros</div><div class="kpiCard__value" style="color:${errors ? "var(--danger)" : "var(--ok)"}">${errors}</div></div>
        <div class="kpiCard"><div class="kpiCard__label">Pendências</div><div class="kpiCard__value" style="color:${pending ? "var(--danger)" : "var(--ok)"}">${pending}</div></div>
      </div>
      <div style="margin-top:10px" class="badges">
        <span class="badge badge--ok">Propostas normalizadas: <strong>${data.propostas.length}</strong></span>
        <span class="badge">Encoding: <strong>${Poc.escapeHtml(data.encoding)}</strong></span>
      </div>
    `;
  }

  function renderFullPreview(kind, stagingInfo, nextLabel, nextAction) {
    const container = document.getElementById("importFullPreview");
    const tableContainer = document.getElementById("previewTableContainer");
    const title = document.getElementById("previewTitle");
    const btnNext = document.getElementById("btnConcluirImport");

    container.classList.remove("card--hidden");
    title.textContent = `Pré-visualização: ${kind}`;
    btnNext.textContent = nextLabel;
    btnNext.onclick = nextAction;

    const headerHtml = stagingInfo.header.map(h => `<th>${Poc.escapeHtml(h)}</th>`).join("");
    const rowsHtml = stagingInfo.staging.map(r => {
      const colsHtml = r.cols.map(c => `<td>${Poc.escapeHtml(c || "")}</td>`).join("");
      return `<tr>${colsHtml}</tr>`;
    }).join("");

    tableContainer.innerHTML = `
      <table class="table--striped">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    tableContainer.scrollTop = 0;
  }

  function renderStaging(kind, containerId, stagingInfo) {
    const container = document.querySelector(containerId);
    if (!container) return;
    container.classList.remove("card--hidden");

    const preview = stagingInfo.staging.slice(0, 8);
    const rowsHtml = preview
      .map((r) => `<tr><td>${r.line}</td><td>${Poc.escapeHtml(r.codigoProposta ?? "—")}</td><td>${Poc.escapeHtml(r.chassi ?? r.produto ?? "—")}</td></tr>`)
      .join("");

    const errors = stagingInfo.errors;
    const errHtml = errors.length
      ? `<div class="badges" style="margin-top:8px;"><span class="badge badge--bad">Erros: <strong>${errors.length}</strong></span></div>
         <ul class="bullets">${errors
        .slice(0, 6)
        .map((e) => `<li><strong>Linha ${e.line}:</strong> ${Poc.escapeHtml(e.message)}</li>`)
        .join("")}</ul>`
      : `<div class="badges" style="margin-top:8px;"><span class="badge badge--ok">Sem erros de chave (POC)</span></div>`;

    container.innerHTML = `
      <h2 style="margin:0 0 10px 0; font-size:16px;">Staging — ${Poc.escapeHtml(kind)}</h2>
      <div class="muted">Preview (primeiras ${preview.length} linhas)</div>
      <div class="tableWrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>Linha</th><th>Código Proposta</th><th>Info</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${errHtml}
    `;
  }

  function renderCross(data) {
    const container = document.getElementById("importCross");
    container.classList.remove("card--hidden");

    const pend = data.pending.slice(0, 10);
    const pendHtml = pend.length
      ? `<ul class="bullets">${pend
        .map((p) => `<li><strong>${Poc.escapeHtml(p.codigoProposta)}</strong> (${p.kind}, linha ${p.line}): ${Poc.escapeHtml(p.message)}</li>`)
        .join("")}</ul>`
      : `<div class="badges"><span class="badge badge--ok">Nenhuma pendência de cruzamento (POC)</span></div>`;

    const totalsegCruzados = (data.propostas || []).filter(p => p.seguros?.length > 0).length;

    container.innerHTML = `
      <h2 style="margin:0 0 10px 0; font-size:16px;">Cruzamento (Vendas × Itens × Totalseg)</h2>
      <div class="badges">
        <span class="badge ${data.errors.length ? "badge--bad" : "badge--ok"}">Erros de chave: <strong>${data.errors.length}</strong></span>
        <span class="badge ${data.pending.length ? "badge--bad" : "badge--ok"}">Itens/Seguros sem venda: <strong>${data.pending.length}</strong></span>
        <span class="badge badge--ok">Propostas com Totalseg: <strong>${totalsegCruzados}</strong></span>
      </div>
      <div style="margin-top:8px" class="muted">Pendências (preview)</div>
      ${pendHtml}
      <div class="actions">
        <a class="btn btn--primary" href="./propostas.html">Ver Propostas</a>
      </div>
    `;
  }

  function clearUi() {
    document.getElementById("importSummary").classList.add("card--hidden");
    document.getElementById("importStagingVendas").classList.add("card--hidden");
    document.getElementById("importStagingItens").classList.add("card--hidden");
    document.getElementById("importStagingTotalseg").classList.add("card--hidden");
    document.getElementById("importCross").classList.add("card--hidden");
    document.getElementById("importFullPreview").classList.add("card--hidden");
  }

  // ---------------------------------------------------------------------------
  // Fluxo principal
  // ---------------------------------------------------------------------------

  let lastProcessedData = null;

  function getCompetenciaFromForm() {
    const mes = document.getElementById("importMes")?.value?.trim() || "";
    const ano = document.getElementById("importAno")?.value?.trim() || "";
    return { mes, ano };
  }

  function setCompetenciaForm(mes, ano) {
    const elMes = document.getElementById("importMes");
    const elAno = document.getElementById("importAno");
    if (elMes) elMes.value = mes ? String(mes).padStart(2, "0") : "";
    if (elAno) elAno.value = ano ? String(ano) : "";
  }

  function updateLoteExistenteDropdown() {
    const sel = document.getElementById("importLoteExistente");
    if (!sel) return;
    const batches = Poc.loadBatches();
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Novo lote (usar mês/ano acima)";
    sel.appendChild(opt0);
    batches.forEach((b) => {
      const o = document.createElement("option");
      o.value = b.competenciaKey;
      o.textContent = `${b.competenciaLabel} (${(b.data?.propostas?.length ?? 0)} propostas)`;
      sel.appendChild(o);
    });
  }

  async function processImport() {
    const { mes, ano } = getCompetenciaFromForm();
    if (!mes || !ano) {
      Poc.toast("Informe a competência (mês e ano) do lote de importação.", "bad");
      return;
    }
    // Percentual ILA não é mais solicitado no formulário (virá de um dos arquivos importados).
    const percentualIla = null;

    const fV = document.getElementById("fileVendas").files?.[0] || null;
    const fI = document.getElementById("fileItens").files?.[0] || null;
    const fT = document.getElementById("fileTotalseg").files?.[0] || null;

    if (!fV && !fI && !fT) {
      Poc.toast("Selecione pelo menos um arquivo (Vendas.csv, Itens.csv ou Totalseg.xlsx).", "bad");
      return;
    }

    const encoding = document.getElementById("importEncoding").value || "utf-8";
    try {
      const [vText, iText, tBuffer] = await Promise.all([
        fV ? readFileAsText(fV, encoding) : Promise.resolve(null),
        fI ? readFileAsText(fI, encoding) : Promise.resolve(null),
        fT ? readFileAsArrayBuffer(fT) : Promise.resolve(null),
      ]);

      const existing = Poc.loadImport() || {};
      let vendasStagingInfo = existing.vendasInfo || { staging: [], errors: [], header: [] };
      let itensStagingInfo = existing.itensInfo || { staging: [], errors: [], header: [] };
      let totalsegStagingInfo = existing.totalsegInfo || { staging: [], errors: [], header: [] };

      if (fV) {
        const csv = parseCsvSemicolon(vText);
        vendasStagingInfo = buildStagingRows(csv, "Vendas");
      }
      if (fI) {
        const csv = parseCsvSemicolon(iText);
        itensStagingInfo = buildStagingRows(csv, "Itens");
      }
      if (fT) {
        if (typeof XLSX === "undefined") {
          Poc.toast("Biblioteca Excel não carregada. Verifique a conexão com a internet.", "bad");
          return;
        }
        const parsed = parseExcel(tBuffer);
        totalsegStagingInfo = buildTotalsegStaging(parsed);
      }

      const propostasByCodigo = normalizeFromVendas(vendasStagingInfo);
      const pendingItens = attachItensToPropostas(itensStagingInfo, propostasByCodigo);
      const pendingTotalseg = attachTotalsegToPropostas(totalsegStagingInfo, propostasByCodigo);
      const pending = [...pendingItens, ...pendingTotalseg];

      const propostas = [...propostasByCodigo.values()].sort((a, b) =>
        String(a.codigoProposta).localeCompare(String(b.codigoProposta))
      );

      lastProcessedData = {
        mes,
        ano,
        percentualIla,
        encoding,
        vendasRaw: vendasStagingInfo.staging,
        itensRaw: itensStagingInfo.staging,
        totalsegRaw: totalsegStagingInfo.staging,
        vendasInfo: vendasStagingInfo,
        itensInfo: itensStagingInfo,
        totalsegInfo: totalsegStagingInfo,
        errors: [...vendasStagingInfo.errors, ...itensStagingInfo.errors, ...totalsegStagingInfo.errors],
        pending,
        propostas,
      };

      clearUi();
      document.querySelector(".dropzone").parentElement.style.display = "none";
      document.querySelector(".actions").style.display = "none";

      // Encadea as pré-visualizações dos arquivos selecionados
      const previews = [];
      if (fV) previews.push({ label: "Vendas.csv", info: vendasStagingInfo });
      if (fI) previews.push({ label: "Itens.csv", info: itensStagingInfo });
      if (fT) previews.push({ label: "Totalseg.xlsx", info: totalsegStagingInfo });

      function showPreviewChain(idx) {
        if (idx >= previews.length) {
          concluirImportacao();
          return;
        }
        const isLast = idx === previews.length - 1;
        const { label, info } = previews[idx];
        renderFullPreview(
          label,
          info,
          isLast ? "Concluir Importação ✔" : `Próximo: ${previews[idx + 1].label} →`,
          () => showPreviewChain(idx + 1)
        );
      }

      showPreviewChain(0);
      Poc.toast("Arquivo(s) lido(s). Confira os dados antes de concluir.", "ok");
    } catch (e) {
      console.error(e);
      Poc.toast(`Falha ao processar: ${e?.message || e}`, "bad");
    }
  }

  function concluirImportacao() {
    if (!lastProcessedData) return;

    const { mes, ano } = lastProcessedData;
    if (!mes || !ano) {
      Poc.toast("Competência (mês/ano) não informada. Reinicie o processo e selecione mês e ano.", "bad");
      return;
    }

    // Salva como lote da competência (sobrescreve se já existir)
    const dataToSave = {
      encoding: lastProcessedData.encoding,
      vendasRaw: lastProcessedData.vendasRaw,
      itensRaw: lastProcessedData.itensRaw,
      totalsegRaw: lastProcessedData.totalsegRaw,
      vendasInfo: lastProcessedData.vendasInfo,
      itensInfo: lastProcessedData.itensInfo,
      totalsegInfo: lastProcessedData.totalsegInfo,
      errors: lastProcessedData.errors,
      pending: lastProcessedData.pending,
      propostas: lastProcessedData.propostas,
    };
    Poc.saveImportAsBatch(dataToSave, { mes, ano });

    clearUi();
    document.querySelector(".dropzone").parentElement.style.display = "grid";
    document.querySelector(".actions").style.display = "flex";

    const finalData = Poc.loadImport();
    updateLoteExistenteDropdown();
    renderSummary(finalData);
    renderStaging("Vendas", "#importStagingVendas", finalData.vendasInfo);
    renderStaging("Itens", "#importStagingItens", finalData.itensInfo);
    renderStaging("Totalseg", "#importStagingTotalseg", finalData.totalsegInfo);
    renderCross(finalData);

    Poc.toast("Lote de importação salvo para " + (String(mes).padStart(2, "0") + "/" + ano) + ".", "ok");
    lastProcessedData = null;
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const anoSelect = document.getElementById("importAno");
    if (anoSelect) {
      anoSelect.innerHTML = "<option value=\"\">—</option>";
      for (let y = currentYear + 1; y >= currentYear - 5; y--) {
        const o = document.createElement("option");
        o.value = String(y);
        o.textContent = String(y);
        if (y === currentYear) o.selected = true;
        anoSelect.appendChild(o);
      }
    }

    updateLoteExistenteDropdown();
    document.getElementById("importLoteExistente")?.addEventListener("change", function () {
      const key = this.value;
      if (!key) {
        return;
      }
      const batches = Poc.loadBatches();
      const b = batches.find((x) => x.competenciaKey === key);
      if (b) {
        setCompetenciaForm(b.mes, b.ano);
      }
    });

    const fileVendas = document.getElementById("fileVendas");
    const fileItens = document.getElementById("fileItens");
    const fileTotalseg = document.getElementById("fileTotalseg");
    const dropVendas = document.getElementById("dropVendas");
    const dropItens = document.getElementById("dropItens");
    const dropTotalseg = document.getElementById("dropTotalseg");
    const nameVendas = document.getElementById("nameVendas");
    const nameItens = document.getElementById("nameItens");
    const nameTotalseg = document.getElementById("nameTotalseg");

    function setupDropzone(input, drop, nameEl) {
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (file) {
          nameEl.textContent = `Selecionado: ${file.name}`;
          drop.classList.add("dropzone--active");
        } else {
          nameEl.textContent = "";
          drop.classList.remove("dropzone--active");
        }
      });

      ["dragover", "dragenter"].forEach(type => {
        drop.addEventListener(type, (e) => {
          e.preventDefault();
          drop.classList.add("dropzone--dragover");
        });
      });

      ["dragleave", "drop", "dragend"].forEach(type => {
        drop.addEventListener(type, (e) => {
          e.preventDefault();
          drop.classList.remove("dropzone--dragover");
        });
      });

      drop.addEventListener("drop", (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) {
          // Simula seleção via drag-and-drop
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          nameEl.textContent = `Selecionado: ${file.name}`;
          drop.classList.add("dropzone--active");
        }
      });
    }

    if (fileVendas && dropVendas && nameVendas) setupDropzone(fileVendas, dropVendas, nameVendas);
    if (fileItens && dropItens && nameItens) setupDropzone(fileItens, dropItens, nameItens);
    if (fileTotalseg && dropTotalseg && nameTotalseg) setupDropzone(fileTotalseg, dropTotalseg, nameTotalseg);

    document.getElementById("btnProcessar").addEventListener("click", processImport);
    document.getElementById("btnVoltarImport").addEventListener("click", () => {
      clearUi();
      document.querySelector(".dropzone").parentElement.style.display = "grid";
      document.querySelector(".actions").style.display = "flex";
      lastProcessedData = null;
    });
    document.getElementById("btnLimpar").addEventListener("click", () => {
      fileVendas.value = "";
      fileItens.value = "";
      fileTotalseg.value = "";
      nameVendas.textContent = "";
      nameItens.textContent = "";
      nameTotalseg.textContent = "";
      dropVendas.classList.remove("dropzone--active");
      dropItens.classList.remove("dropzone--active");
      dropTotalseg.classList.remove("dropzone--active");
      clearUi();
      Poc.toast("Arquivos e pré-visualização limpos. Os lotes já salvos permanecem.", "ok");
    });
  }

  return { init };
})();
