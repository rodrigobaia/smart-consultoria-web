/* CRUD genérico (POC) — render simples para cadastros em HTML/JS
 * Usa PocStore (localStorage) para persistência.
 */

const PocCrudPage = (() => {
  let state = {
    view: "list", // 'list' or 'form'
    filter: "",
    editId: null,
    pageSize: 10,
    currentPage: 1,
  };

  function render(config) {
    const root = document.getElementById("crudRoot");
    if (!root) throw new Error("Faltou <div id=\"crudRoot\"></div> na página.");

    if (state.view === "form") {
      renderForm(root, config);
    } else {
      renderList(root, config);
    }
  }

  function renderList(root, config) {
    const { entityKey, title, fields } = config;
    const allData = PocStore.load(entityKey);

    // Controle de acesso: Auxiliar, Consultor e Operador são somente leitura
    const sess = Poc.getSession();
    const readOnly = sess && (sess.role === 'Auxiliar' || sess.role === 'Consultor' || sess.role === 'Operador');

    // Filtra campos visíveis na lista (remove seções, infos e hiddenInList)
    const visibleFields = fields.filter(f => f.key && f.type !== 'section' && f.type !== 'info' && !f.hiddenInList);

    const filtered = allData.filter((item) => {
      if (!state.filter) return true;
      const f = state.filter.toLowerCase();
      return visibleFields.some((field) =>
        String(item[field.key] ?? "").toLowerCase().includes(f)
      );
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / state.pageSize);
    if (state.currentPage > totalPages && totalPages > 0) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = startIdx + state.pageSize;
    const paginated = filtered.slice(startIdx, endIdx);

    const rowsHtml = paginated
      .map((item) => {
        const cols = visibleFields
          .map((f) => {
            if (typeof f.render === 'function') {
              return `<td>${f.render(item)}</td>`;
            }
            let val = item[f.key] ?? "—";
            if (Array.isArray(val)) val = val.join(", ");
            return `<td>${Poc.escapeHtml(String(val))}</td>`;
          })
          .join("");
        return `
          <tr>
            ${cols}
            ${!readOnly ? `<td style="white-space:nowrap; text-align:right;">
              <button class="btn btn--ghost" data-edit="${Poc.escapeHtml(item.id)}">Editar</button>
              <button class="btn btn--ghost" data-del="${Poc.escapeHtml(item.id)}">Excluir</button>
            </td>` : ''}
          </tr>
        `;
      })
      .join("");

    root.innerHTML = `
      <div class="card">
        <div class="row row--between row--wrap" style="margin-bottom: 20px;">
          <div>
            <h1>${Poc.escapeHtml(title)}</h1>
            <p class="muted">Lista de registros com filtro e busca.</p>
          </div>
          ${!readOnly && !config.hideAddBtn ? `<button id="btnNovo" class="btn btn--primary">＋ ${Poc.escapeHtml(config.addButtonLabel || "Novo Registro")}</button>` : ''}
        </div>

        <div class="row row--wrap" style="gap: 10px; margin-bottom: 20px;">
          <div class="field field--inline" style="flex: 1;">
            <input id="txtFilter" type="text" placeholder="Filtrar registros..." value="${Poc.escapeHtml(state.filter)}" autocomplete="off" />
          </div>
          ${!readOnly ? '<button id="btnClearData" class="btn btn--ghost">Limpar Base</button>' : ''}
        </div>

        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                ${visibleFields.map((f) => `<th>${Poc.escapeHtml(f.label)}</th>`).join("")}
                ${!readOnly ? '<th style="text-align:right;">Ações</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="${visibleFields.length + 1}" class="muted" style="text-align:center; padding: 40px;">Nenhum registro encontrado.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="row row--between" style="margin-top: 15px;">
          <div class="muted" style="font-size: 13px;">
            Total: <strong>${allData.length}</strong> registros ${state.filter ? `(Filtrado: <strong>${filtered.length}</strong>)` : ""}
          </div>
          
          ${totalPages > 1 ? `
            <div class="pagination">
              <button class="pagination__btn" id="btnPrevPage" ${state.currentPage === 1 ? 'disabled' : ''}>← Anterior</button>
              <div class="pagination__info">Página <strong>${state.currentPage}</strong> de <strong>${totalPages}</strong></div>
              <button class="pagination__btn" id="btnNextPage" ${state.currentPage === totalPages ? 'disabled' : ''}>Próxima →</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Events
    if (!readOnly && !config.hideAddBtn) {
      const btnNovo = document.getElementById("btnNovo");
      if (btnNovo) btnNovo.onclick = () => {
        state.view = "form";
        state.editId = null;
        render(config);
      };
    }

    const txtFilter = document.getElementById("txtFilter");
    if (txtFilter) {
      txtFilter.oninput = (e) => {
        state.filter = e.target.value;
        state.currentPage = 1;
        render(config);
        document.getElementById("txtFilter").focus();
      };
    }

    const btnClearData = document.getElementById("btnClearData");
    if (btnClearData) {
      btnClearData.onclick = () => {
        if (!confirm("Limpar todos os registros deste cadastro?")) return;
        PocStore.clear(entityKey);
        Poc.toast("Cadastro limpo.", "ok");
        state.currentPage = 1;
        render(config);
      };
    }

    if (document.getElementById("btnPrevPage")) {
      document.getElementById("btnPrevPage").onclick = () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          render(config);
        }
      };
    }

    if (document.getElementById("btnNextPage")) {
      document.getElementById("btnNextPage").onclick = () => {
        if (state.currentPage < totalPages) {
          state.currentPage++;
          render(config);
        }
      };
    }

    root.querySelectorAll("button[data-edit]").forEach((btn) => {
      btn.onclick = () => {
        state.editId = btn.getAttribute("data-edit");
        state.view = "form";
        render(config);
      };
    });

    root.querySelectorAll("button[data-del]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-del");
        PocStore.remove(entityKey, id);
        Poc.toast("Registro removido.", "ok");
        render(config);
      };
    });
  }

  function renderForm(root, config) {
    const { title, fields, entityKey } = config;
    const allData = PocStore.load(entityKey);
    const itemToEdit = state.editId ? allData.find(x => x.id === state.editId) : null;

    const fieldsHtml = fields.map(f => {
      const id = `f_${f.key}`;
      const labelStr = Poc.escapeHtml(f.label);
      const req = f.required ? '<b style="color:var(--danger)">*</b>' : '';
      let currentVal = itemToEdit ? (itemToEdit[f.key] ?? '') : '';

      if (f.type === 'section') {
        return `<h2 style="grid-column: 1 / -1; margin-top:20px; border-bottom:2px solid var(--border); padding-bottom:8px; color:var(--primary); font-size:1.25rem;">${labelStr}</h2>`;
      }

      if (f.type === 'info') {
        return `<div style="grid-column: 1 / -1; padding:12px; border-radius:var(--radius2); background:var(--panel2); border-left:4px solid var(--primary); font-size:14px; color:var(--text); line-height:1.5;">${labelStr}</div>`;
      }

      if (f.type === 'select' && Array.isArray(f.options)) {
        const optionsHtml = (f.options || []).map(opt => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lab = typeof opt === 'string' ? opt : opt.label;
          const selected = (val === currentVal || (Array.isArray(currentVal) && currentVal.includes(val))) ? 'selected' : '';
          return `<option value="${Poc.escapeHtml(val)}" ${selected}>${Poc.escapeHtml(lab)}</option>`;
        }).join("");

        return `
          <label class="field" for="${id}">
            <span class="field__label">${labelStr} ${req}</span>
            <select id="${id}" ${f.multiple ? 'multiple style="height:100px; padding:5px;"' : ''}>
              ${!f.multiple ? '<option value="">(Selecione)</option>' : ''}
              ${optionsHtml}
            </select>
            ${f.multiple ? '<small class="muted">Segure Ctrl para selecionar vários</small>' : ''}
          </label>
        `;
      }

      if (f.type === 'checkbox-group' && Array.isArray(f.options)) {
        const checksHtml = (f.options || []).map((opt, idx) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lab = typeof opt === 'string' ? opt : opt.label;
          const name = `check_${f.key}`;
          return `
            <label class="row" style="gap:8px; cursor:pointer;">
              <input type="checkbox" name="${name}" value="${Poc.escapeHtml(val)}" ${Array.isArray(currentVal) && currentVal.includes(val) ? 'checked' : ''} />
              <span style="font-size:13px; color:var(--text);">${Poc.escapeHtml(lab)}</span>
            </label>
          `;
        }).join("");

        return `
          <div class="field">
            <span class="field__label">${labelStr} ${req}</span>
            <div class="grid" style="gap:8px; padding:10px; border:1px solid var(--border); border-radius:var(--radius2); background:var(--panel2); max-height:150px; overflow:auto;">
              ${checksHtml}
            </div>
            <small class="muted">Selecione as opções desejadas</small>
          </div>
        `;
      }

      const prefix = f.prefix ? `<span class="field__prefix" style="padding: 0 10px; background: var(--panel2); border-right: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; color: var(--text-muted);">${f.prefix}</span>` : '';
      const suffix = f.suffix ? `<span class="field__suffix" style="padding: 0 10px; background: var(--panel2); border-left: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; color: var(--text-muted);">${f.suffix}</span>` : '';

      return `
        <label class="field" for="${id}">
          <span class="field__label">${labelStr} ${req}</span>
          <div style="display: flex; border: 1px solid var(--border); border-radius: var(--radius2); overflow: hidden; background: var(--input-bg);">
            ${prefix}
            <input id="${id}" 
                   type="${f.type || 'text'}" 
                   placeholder="${Poc.escapeHtml(f.placeholder || '')}" 
                   autocomplete="off" 
                   value="${Poc.escapeHtml(String(currentVal))}" 
                   ${f.min !== undefined ? `min="${f.min}"` : ''} 
                   ${f.max !== undefined ? `max="${f.max}"` : ''}
                   style="flex: 1; border: none; border-radius: 0; outline: none;" />
            ${suffix}
          </div>
        </label>
      `;
    }).join("");

    root.innerHTML = `
      <div class="card" style="width: 100%;">
        <div style="margin-bottom: 24px;">
          <button id="btnVoltar" class="btn btn--ghost" style="margin-bottom: 15px;">← Voltar para Lista</button>
          <h1>${state.editId ? 'Editar' : 'Novo'}: ${Poc.escapeHtml(title)}</h1>
          <p class="muted">${state.editId ? 'Atualize os dados do registro.' : 'Preencha os campos abaixo para adicionar um novo registro.'}</p>
        </div>

        ${config.tabs ? `
          <div class="tabBar">
            ${config.tabs.map((t, idx) => `
              <button class="tabBtn ${idx === 0 ? 'tabBtn--active' : ''}" data-tab-target="${idx}">
                ${Poc.escapeHtml(t.label)}
              </button>
            `).join("")}
          </div>
        ` : ''}

        <div class="tabContents">
          ${config.tabs ? config.tabs.map((t, idx) => `
            <div class="tabContent ${idx === 0 ? 'tabContent--active' : ''}" data-tab-id="${idx}">
              <div class="grid" style="gap: 16px;">
                ${fields.filter(f => f.tab === t.key || (!f.tab && idx === 0)).map(f => {
      // Reuse original field rendering logic...
      return renderFieldHtml(f, itemToEdit);
    }).join("")}
              </div>
              <div id="customTabContent_${t.key}"></div>
            </div>
          `).join("") : `
            <div class="grid" style="gap: 16px;">
              ${fields.map(f => renderFieldHtml(f, itemToEdit)).join("")}
            </div>
          `}
        </div>

        <div class="actions" style="margin-top: 30px; border-top: 1px solid var(--border); padding-top: 20px;">
          <button id="btnSave" class="btn btn--primary" style="flex: 1;">${state.editId ? 'Atualizar' : 'Salvar'} Registro</button>
          <button id="btnCancel" class="btn btn--ghost">Cancelar</button>
        </div>
      </div>
    `;

    function renderFieldHtml(f, itemToEdit) {
      const id = `f_${f.key}`;
      const labelStr = Poc.escapeHtml(f.label);
      const req = f.required ? '<b style="color:var(--danger)">*</b>' : '';
      let currentVal = itemToEdit ? (itemToEdit[f.key] ?? '') : '';

      if (f.type === 'section') {
        return `<h2 style="grid-column: 1 / -1; margin-top:20px; border-bottom:2px solid var(--border); padding-bottom:8px; color:var(--primary); font-size:1.25rem;">${labelStr}</h2>`;
      }

      if (f.type === 'info') {
        return `<div style="grid-column: 1 / -1; padding:12px; border-radius:var(--radius2); background:var(--panel2); border-left:4px solid var(--primary); font-size:14px; color:var(--text); line-height:1.5;">${labelStr}</div>`;
      }

      if (f.type === 'select' && Array.isArray(f.options)) {
        const optionsHtml = (f.options || []).map(opt => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lab = typeof opt === 'string' ? opt : opt.label;
          const selected = (val === currentVal || (Array.isArray(currentVal) && currentVal.includes(val))) ? 'selected' : '';
          return `<option value="${Poc.escapeHtml(val)}" ${selected}>${Poc.escapeHtml(lab)}</option>`;
        }).join("");

        return `
          <label class="field" for="${id}">
            <span class="field__label">${labelStr} ${req}</span>
            <select id="${id}" ${f.multiple ? 'multiple style="height:100px; padding:5px;"' : ''}>
              ${!f.multiple ? '<option value="">(Selecione)</option>' : ''}
              ${optionsHtml}
            </select>
            ${f.multiple ? '<small class="muted">Segure Ctrl para selecionar vários</small>' : ''}
          </label>
        `;
      }

      if (f.type === 'checkbox-group' && Array.isArray(f.options)) {
        const checksHtml = (f.options || []).map((opt, idx) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lab = typeof opt === 'string' ? opt : opt.label;
          const name = `check_${f.key}`;
          return `
            <label class="row" style="gap:8px; cursor:pointer;">
              <input type="checkbox" name="${name}" value="${Poc.escapeHtml(val)}" ${Array.isArray(currentVal) && currentVal.includes(val) ? 'checked' : ''} />
              <span style="font-size:13px; color:var(--text);">${Poc.escapeHtml(lab)}</span>
            </label>
          `;
        }).join("");

        return `
          <div class="field">
            <span class="field__label">${labelStr} ${req}</span>
            <div class="grid" style="gap:8px; padding:10px; border:1px solid var(--border); border-radius:var(--radius2); background:var(--panel2); max-height:150px; overflow:auto;">
              ${checksHtml}
            </div>
            <small class="muted">Selecione as opções desejadas</small>
          </div>
        `;
      }

      const prefix = f.prefix ? `<span class="field__prefix" style="padding: 0 10px; background: var(--panel2); border-right: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; color: var(--text-muted);">${f.prefix}</span>` : '';
      const suffix = f.suffix ? `<span class="field__suffix" style="padding: 0 10px; background: var(--panel2); border-left: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; color: var(--text-muted);">${f.suffix}</span>` : '';

      return `
        <label class="field" for="${id}">
          <span class="field__label">${labelStr} ${req}</span>
          <div style="display: flex; border: 1px solid var(--border); border-radius: var(--radius2); overflow: hidden; background: var(--input-bg);">
            ${prefix}
            <input id="${id}" 
                   type="${f.type || 'text'}" 
                   placeholder="${Poc.escapeHtml(f.placeholder || '')}" 
                   autocomplete="off" 
                   value="${Poc.escapeHtml(String(currentVal))}" 
                   ${f.min !== undefined ? `min="${f.min}"` : ''} 
                   ${f.max !== undefined ? `max="${f.max}"` : ''}
                   style="flex: 1; border: none; border-radius: 0; outline: none;" />
            ${suffix}
          </div>
        </label>
      `;
    }

    if (config.tabs) {
      document.querySelectorAll(".tabBtn").forEach(btn => {
        btn.onclick = () => {
          const target = btn.getAttribute("data-tab-target");
          document.querySelectorAll(".tabBtn").forEach(b => b.classList.remove("tabBtn--active"));
          document.querySelectorAll(".tabContent").forEach(c => c.classList.remove("tabContent--active"));
          btn.classList.add("tabBtn--active");
          root.querySelector(`.tabContent[data-tab-id="${target}"]`).classList.add("tabContent--active");
        };
      });
    }

    document.getElementById("btnVoltar").onclick = document.getElementById("btnCancel").onclick = () => {
      state.view = "list";
      render(config);
    };

    document.getElementById("btnSave").onclick = () => {
      const obj = {};
      for (const f of fields) {
        if (f.type === 'section' || f.type === 'info') continue;

        if (f.type === 'checkbox-group') {
          const checks = document.querySelectorAll(`input[name="check_${f.key}"]:checked`);
          obj[f.key] = Array.from(checks).map(c => c.value);
        } else {
          const el = document.getElementById(`f_${f.key}`);
          if (f.multiple && el.tagName === 'SELECT') {
            obj[f.key] = Array.from(el.selectedOptions).map(opt => opt.value);
          } else {
            obj[f.key] = (el.value || "").trim();
          }
        }
      }

      const missing = fields.filter(f => f.required && !obj[f.key]);
      if (missing.length) {
        Poc.toast(`Campos obrigatórios: ${missing.map(m => m.label).join(", ")}`, "bad");
        return;
      }

      if (typeof config.onSave === 'function') {
        const payload = state.editId ? { ...obj, id: state.editId } : obj;
        config.onSave(payload, () => {
          state.view = "list";
          render(config);
        });
      } else {
        if (state.editId) {
          PocStore.update(entityKey, state.editId, obj);
          Poc.toast("Registro atualizado!", "ok");
        } else {
          PocStore.add(entityKey, obj);
          Poc.toast("Registro salvo!", "ok");
        }
        state.view = "list";
        render(config);
      }
    };

    if (typeof config.onAfterRenderForm === 'function') {
      config.onAfterRenderForm(root, state.editId);
    }
  }

  return { render };
})();


