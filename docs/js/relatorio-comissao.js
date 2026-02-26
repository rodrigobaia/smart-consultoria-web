const PocRelatorioComissao = (() => {
    let state = {
        data: [], // All filtered data
        pageSize: 10,
        currentPage: 1,
        filters: {
            dataInicio: "",
            dataFim: "",
            lojas: [],
            colaboradores: [],
        },
    };

    const currentSession = Poc.getSession();
    const isAdminOrGestor = ["Administrador", "Gestor"].includes(currentSession?.role);

    function init() {
        setupFilters();
        bindEvents();
        renderFiltersByRole();
    }

    function setupFilters() {
        // Set default dates (current month)
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

        document.getElementById("filterDataInicio").value = firstDay;
        document.getElementById("filterDataFim").value = lastDay;

        flatpickr("#filterDataInicio", { locale: "pt", dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y" });
        flatpickr("#filterDataFim", { locale: "pt", dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y" });
    }

    function renderFiltersByRole() {
        if (isAdminOrGestor) {
            document.getElementById("filterLojaContainer").style.display = "block";
            document.getElementById("filterColaboradorContainer").style.display = "block";

            const stores = PocStore.load("lojas");
            const listLojas = document.getElementById("listLojas");
            listLojas.innerHTML = `
        <label class="multi-select-item">
          <input type="checkbox" id="checkAllLojas" checked /> <span style="font-weight:bold">Selecionar Todos</span>
        </label>
        ${stores.map(s => `
          <label class="multi-select-item">
            <input type="checkbox" name="loja" value="${s.nomeFantasia}" checked /> ${s.nomeFantasia}
          </label>
        `).join("")}
      `;

            const collaborators = PocStore.load("colaboradores");
            const listColabs = document.getElementById("listColaboradores");
            listColabs.innerHTML = `
        <label class="multi-select-item">
          <input type="checkbox" id="checkAllColabs" checked /> <span style="font-weight:bold">Selecionar Todos</span>
        </label>
        ${collaborators.map(c => `
          <label class="multi-select-item">
            <input type="checkbox" name="colaborador" value="${c.nome}" checked /> ${c.nome}
          </label>
        `).join("")}
      `;

            // Event delegation for "Select All"
            document.getElementById("checkAllLojas").onchange = (e) => {
                document.querySelectorAll('input[name="loja"]').forEach(cb => cb.checked = e.target.checked);
            };
            document.getElementById("checkAllColabs").onchange = (e) => {
                document.querySelectorAll('input[name="colaborador"]').forEach(cb => cb.checked = e.target.checked);
            };

        } else {
            document.getElementById("filterInfoUser").style.display = "block";
            document.getElementById("txtUserLocked").value = currentSession?.name || "Usuário não identificado";
        }
    }

    function bindEvents() {
        document.getElementById("btnFiltrar").addEventListener("click", () => {
            state.currentPage = 1;
            processReport();
        });

        document.getElementById("btnLimparFiltros").addEventListener("click", () => {
            setupFilters();
            if (isAdminOrGestor) {
                document.getElementById("checkAllLojas").checked = true;
                document.getElementById("checkAllColabs").checked = true;
                document.querySelectorAll('input[name="loja"], input[name="colaborador"]').forEach(cb => cb.checked = true);
            }
            state.data = [];
            renderTable();
        });

        document.getElementById("btnExportPdf").addEventListener("click", () => {
            if (!state.data.length) return Poc.toast("Gere o relatório primeiro.", "bad");
            Poc.toast("Gerando PDF... (Simulado)", "ok");
        });

        document.getElementById("btnExportExcel").addEventListener("click", () => {
            if (!state.data.length) return Poc.toast("Gere o relatório primeiro.", "bad");
            Poc.toast("Gerando Excel... (Simulado)", "ok");
        });

        document.getElementById("btnPrevPage").onclick = () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                renderTable();
            }
        };
        document.getElementById("btnNextPage").onclick = () => {
            const totalPages = Math.ceil(state.data.length / state.pageSize);
            if (state.currentPage < totalPages) {
                state.currentPage++;
                renderTable();
            }
        };
    }

    function generateMockData() {
        const mockProposals = [];
        const stores = PocStore.load("lojas").map(s => s.nomeFantasia);
        if (stores.length === 0) stores.push("Loja Matriz", "Loja Filial");

        // Use current user's name for consistency if not admin
        const collaborators = isAdminOrGestor
            ? (PocStore.load("colaboradores").map(c => c.nome).concat(["Colaborador Exemplo"]))
            : [currentSession?.name || "Consultor Teste"];

        const products = ["Financiamento Ford Credit", "Seguro Prestamista", "CDC Premium", "Plano Balão"];

        for (let i = 0; i < 25; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));
            const formattedDate = date.toLocaleDateString("pt-BR");
            const isoDate = date.toISOString().split("T")[0];

            const valorBruto = (50000 + Math.random() * 50000).toFixed(2);
            const valorComissao = (valorBruto * 0.015).toFixed(2);

            mockProposals.push({
                data: formattedDate,
                _rowDate: isoDate,
                vendedorResponsavel: collaborators[Math.floor(Math.random() * collaborators.length)],
                colaborador: collaborators[Math.floor(Math.random() * collaborators.length)],
                nomeFantasiaLoja: stores[Math.floor(Math.random() * stores.length)],
                loja: stores[Math.floor(Math.random() * stores.length)],
                cnpjLoja: "00.000.000/0001-00",
                codigoProposta: `PROP-${1000 + i}`,
                valorBruto: parseFloat(valorBruto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                valorFinanciado: parseFloat(valorBruto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                valorComissao: parseFloat(valorComissao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                produto: products[Math.floor(Math.random() * products.length)],
                nomeProduto: products[Math.floor(Math.random() * products.length)],
            });
        }
        return mockProposals;
    }

    function processReport() {
        let importData = Poc.loadImport();

        if (!importData || !importData.propostas || importData.propostas.length === 0) {
            console.log("POC: Usando dados mockados para visualização.");
            importData = { propostas: generateMockData() };
        }

        const start = document.getElementById("filterDataInicio").value;
        const end = document.getElementById("filterDataFim").value;

        let selectedLojas = [];
        let selectedColabs = [];

        if (isAdminOrGestor) {
            selectedLojas = Array.from(document.querySelectorAll('input[name="loja"]:checked')).map(cb => cb.value);
            selectedColabs = Array.from(document.querySelectorAll('input[name="colaborador"]:checked')).map(cb => cb.value);
        } else {
            selectedColabs = [currentSession?.name];
        }

        state.data = importData.propostas.filter(p => {
            const dateVal = p._rowDate || "";
            // Correct Date Comparison
            const proposalDate = dateVal; // It's already YYYY-MM-DD
            const isDateOk = (!start || proposalDate >= start) && (!end || proposalDate <= end);

            const isColabOk = isAdminOrGestor
                ? selectedColabs.includes(p.vendedorResponsavel || p.colaborador)
                : (p.vendedorResponsavel === currentSession?.name || p.colaborador === currentSession?.name);

            const isLojaOk = !isAdminOrGestor || selectedLojas.includes(p.nomeFantasiaLoja || p.loja);

            return isDateOk && isColabOk && isLojaOk;
        });

        renderTable();
    }

    function renderTable() {
        const tbody = document.getElementById("tbodyRelatorio");
        const countEl = document.getElementById("countRegistros");
        const sumEl = document.getElementById("sumComissoes");
        const summary = document.getElementById("reportSummary");
        const pagination = document.getElementById("paginationContainer");

        if (!state.data.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center; padding: 40px;">Nenhum registro encontrado para os filtros selecionados.</td></tr>';
            summary.style.display = "none";
            pagination.style.display = "none";
            return;
        }

        summary.style.display = "flex";
        pagination.style.display = "flex";

        const totalItems = state.data.length;
        const totalPages = Math.ceil(totalItems / state.pageSize);
        if (state.currentPage > totalPages) state.currentPage = totalPages;
        if (state.currentPage < 1) state.currentPage = 1;

        const startIdx = (state.currentPage - 1) * state.pageSize;
        const paginated = state.data.slice(startIdx, startIdx + state.pageSize);

        countEl.textContent = totalItems;

        let totalComissao = 0;
        state.data.forEach(p => {
            const v = parseFloat(String(p.valorComissao).replace("R$", "").replace(/\./g, "").replace(",", ".")) || 0;
            totalComissao += v;
        });
        sumEl.textContent = totalComissao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        tbody.innerHTML = paginated.map(p => `
      <tr>
        <td>${p.data || new Date().toLocaleDateString("pt-BR")}</td>
        <td>${p.vendedorResponsavel || p.colaborador || "—"}</td>
        <td>${p.nomeFantasiaLoja || p.loja || "—"}</td>
        <td>${p.cnpjLoja || "—"}</td>
        <td>${p.codigoProposta || "—"}</td>
        <td>${p.valorBruto || p.valorFinanciado || "R$ 0,00"}</td>
        <td><strong>${p.valorComissao || "R$ 0,00"}</strong></td>
        <td>${p.produto || p.nomeProduto || "—"}</td>
      </tr>
    `).join("");

        document.getElementById("currentPage").textContent = state.currentPage;
        document.getElementById("totalPages").textContent = totalPages;
        document.getElementById("btnPrevPage").disabled = state.currentPage === 1;
        document.getElementById("btnNextPage").disabled = state.currentPage === totalPages;
    }

    return { init };
})();

window.PocRelatorioComissao = PocRelatorioComissao;
