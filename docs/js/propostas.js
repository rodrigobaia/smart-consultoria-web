const PocPropostas = (() => {
  let state = {
    data: [],
    pageSize: 15,
    currentPage: 1,
    search: ""
  };

  function renderPropostas() {
    const wrap = document.getElementById("propostasTableWrap");
    const empty = document.getElementById("propostasEmpty");
    const detail = document.getElementById("propostaDetail");
    const pagination = document.getElementById("paginationContainer");

    const list = state.data || [];

    if (!list.length) {
      wrap.innerHTML = "";
      detail.classList.add("card--hidden");
      empty.style.display = "block";
      pagination.style.display = "none";
      return;
    }
    empty.style.display = "none";

    const filtered = !state.search
      ? list
      : list.filter((p) => {
        const hay = `${p.codigoProposta} ${p.loja ?? ""} ${p.cnpjLoja ?? ""} ${p.banco ?? ""} ${p.status ?? ""}`.toLowerCase();
        return hay.includes(state.search);
      });

    if (filtered.length === 0) {
      wrap.innerHTML = `<p class="muted" style="text-align:center; padding:20px;">Nenhum resultado para "${state.search}".</p>`;
      pagination.style.display = "none";
      return;
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / state.pageSize);
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const paginated = filtered.slice(startIdx, startIdx + state.pageSize);

    pagination.style.display = totalPages > 1 ? "flex" : "none";

    const rows = paginated
      .map((p) => {
        return `<tr>
          <td><a class="link" data-codigo="${Poc.escapeHtml(p.codigoProposta)}">${Poc.escapeHtml(p.codigoProposta)}</a></td>
          <td>${Poc.escapeHtml(p.loja ?? "—")}</td>
          <td>${Poc.escapeHtml(p.cnpjLoja ?? "—")}</td>
          <td>${Poc.escapeHtml(p.banco ?? "—")}</td>
          <td>${Poc.formatMoneyBR(p.valorFinanciado)}</td>
          <td>${Poc.escapeHtml(p.status ?? "—")}</td>
          <td>${p.itens?.length || 0}</td>
        </tr>`;
      })
      .join("");

    wrap.innerHTML = `
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Loja</th>
              <th>CNPJ</th>
              <th>Banco</th>
              <th>Valor Financiado</th>
              <th>Status</th>
              <th>Itens</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="muted" style="margin-top:8px; font-size:12px;">
        Mostrando ${paginated.length} de ${filtered.length} propostas.
      </div>
    `;

    document.getElementById("currentPage").textContent = state.currentPage;
    document.getElementById("totalPages").textContent = totalPages;
    document.getElementById("btnPrevPage").disabled = state.currentPage === 1;
    document.getElementById("btnNextPage").disabled = state.currentPage === totalPages;

    wrap.querySelectorAll("a.link[data-codigo]").forEach((a) => {
      a.addEventListener("click", () => showDetail(a.getAttribute("data-codigo")));
    });
  }

  function showDetail(codigo) {
    const p = (state.data || []).find((x) => x.codigoProposta === codigo);
    if (!p) return;
    const el = document.getElementById("propostaDetail");
    el.classList.remove("card--hidden");

    const itens = p.itens || [];
    const itensRows = itens
      .slice(0, 200)
      .map((it) => {
        return `<tr>
          <td>${Poc.escapeHtml(it.tipo ?? "—")}</td>
          <td>${Poc.escapeHtml(it.codigoItem ?? "—")}</td>
          <td>${Poc.escapeHtml(it.fornecedor ?? "—")}</td>
          <td>${Poc.escapeHtml(it.descricao ?? "—")}</td>
          <td>${it.quantidade ?? "—"}</td>
          <td>${Poc.formatMoneyBR(it.valorUnitario)}</td>
          <td>${it.cortesia ? "Sim" : "Não"}</td>
        </tr>`;
      })
      .join("");

    el.innerHTML = `
      <div class="row row--between row--wrap">
        <div>
          <h2 style="margin:0; font-size:16px;">Detalhe — Proposta ${Poc.escapeHtml(p.codigoProposta)}</h2>
          <div class="muted">${Poc.escapeHtml(p.loja ?? "—")} • ${Poc.escapeHtml(p.banco ?? "—")}</div>
        </div>
        <div class="badges">
          <span class="badge">Itens: <strong>${itens.length}</strong></span>
          <span class="badge">Valor Financiado: <strong>${Poc.formatMoneyBR(p.valorFinanciado)}</strong></span>
        </div>
      </div>

      <div class="grid grid--2" style="margin-top:10px;">
        <div class="kpiCard">
          <div class="kpiCard__label">CNPJ Loja</div>
          <div class="kpiCard__value" style="font-size:16px;">${Poc.escapeHtml(p.cnpjLoja ?? "—")}</div>
        </div>
        <div class="kpiCard">
          <div class="kpiCard__label">Status</div>
          <div class="kpiCard__value" style="font-size:16px;">${Poc.escapeHtml(p.status ?? "—")}</div>
        </div>
      </div>

      <div style="margin-top:12px" class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Código</th>
              <th>Fornecedor</th>
              <th>Descrição</th>
              <th>Qtd</th>
              <th>Valor Unit.</th>
              <th>Cortesia</th>
            </tr>
          </thead>
          <tbody>${itensRows || `<tr><td colspan="7" class="muted">Sem itens.</td></tr>`}</tbody>
        </table>
      </div>
    `;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function init() {
    const importData = Poc.loadImport();
    state.data = importData?.propostas || [];

    document.getElementById("propostaSearch").addEventListener("input", (e) => {
      state.search = e.target.value.toLowerCase();
      state.currentPage = 1;
      renderPropostas();
    });

    document.getElementById("btnPrevPage").onclick = () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderPropostas();
      }
    };

    document.getElementById("btnNextPage").onclick = () => {
      const filtered = !state.search ? state.data : state.data.filter(p => `${p.codigoProposta} ${p.loja ?? ""} ${p.cnpjLoja ?? ""} ${p.banco ?? ""} ${p.status ?? ""}`.toLowerCase().includes(state.search));
      const totalPages = Math.ceil(filtered.length / state.pageSize);
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderPropostas();
      }
    };

    renderPropostas();
  }

  return { init };
})();


