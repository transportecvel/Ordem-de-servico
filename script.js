// CONFIGURAÇÃO DOS WEBHOOKS INTEGRADOS
const URL_SALVAR = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/ordem-servico-caminhao";
const URL_ALTERAR = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/alterar-ordem";
const URL_DELETAR = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/deletar-os";

const URL_FROTA = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/buscar-frotas";
const URL_OFICINAS = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/buscar-oficinas";
const URL_CAD_FROTA = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/cadastrar-frota";
const URL_CAD_OFICINA = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/cadastrar-prestador";
const URL_HISTORICO = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/buscar-ordens";

let dicionarioFrotas = {};
let bancoOrdensCompleto = []; 
let listaFiltradaGlobal = []; 
let paginaAtual = 1;
const itensPorPagina = 14;
let osSendoEditada = null; 

function alternarPainelHistorico() {
    const layout = document.getElementById('layoutPrincipal');
    const btnText = document.getElementById('btnToggleText');
    const btnIcon = document.getElementById('btnToggleIcon');
    layout.classList.toggle('historico-aberto');
    fecharPopUpAcoes();
    if(layout.classList.contains('historico-aberto')) { btnText.innerText = "Fechar"; btnIcon.innerText = "✖"; } 
    else { btnText.innerText = "Ver Histórico"; btnIcon.innerText = "📋"; }
}

function obterValorCamaleao(obj, termosBusca) {
    if (!obj || typeof obj !== 'object') return "";
    const chaves = Object.keys(obj);
    for (let termo of termosBusca) {
        const chaveEncontrada = chaves.find(k => k.toLowerCase().trim() === termo.toLowerCase().trim());
        if (chaveEncontrada && obj[chaveEncontrada] !== undefined && obj[chaveEncontrada] !== null) {
            let valor = obj[chaveEncontrada];
            if (typeof valor === 'object') return (valor.value || JSON.stringify(valor)).toString();
            return valor.toString();
        }
    }
    return "";
}

function construirDescricaoServicos(item) {
    let descPronta = obterValorCamaleao(item, ['descricao', 'descrição', 'descricaoservico']);
    if (descPronta && descPronta !== "---") return descPronta;
    let s1 = obterValorCamaleao(item, ['Primeiro serviço', 'Primeiro servico', 'servico1', 'serviço1']);
    let s2 = obterValorCamaleao(item, ['Segundo serviço', 'Segundo servico', 'servico2', 'serviço2']);
    let s3 = obterValorCamaleao(item, ['Terceiro serviço', 'Terceiro servico', 'servico3', 'serviço3']);
    let arr = [];
    if (s1 && s1 !== "---") arr.push(s1); if (s2 && s2 !== "---") arr.push(s2); if (s3 && s3 !== "---") arr.push(s3);
    return arr.length > 0 ? arr.join(" | ") : "---";
}

async function carregarBancoDeDados() {
    try {
        const resFrota = await fetch(URL_FROTA);
        if (resFrota.ok) {
            let frotas = await resFrota.json();
            if (!Array.isArray(frotas) && frotas.frotas) frotas = frotas.frotas;
            if (!Array.isArray(frotas)) frotas = [frotas];
            const selectFrota = document.getElementById('selectFrota');
            frotas.forEach(f => {
                const item = f.json || f;
                let frotaNum = item.FROTA || item.frota || item.Frota;
                let placaTexto = item.PLACA || item.placa || item.Placa;
                if(frotaNum && placaTexto) {
                    dicionarioFrotas[frotaNum] = { 
                        placa: placaTexto, modelo: item.MODELO || item.modelo || "NÃO INFORMADO", 
                        filial: item.FILIAL || item.filial || "NÃO INFORMADO", cnpj: item.CNPJ || item.cnpj || "NÃO INFORMADO" 
                    };
                    if (![...selectFrota.options].some(o => o.value === frotaNum.toString())) {
                        let opt = document.createElement('option'); opt.value = frotaNum; opt.innerText = frotaNum;
                        selectFrota.appendChild(opt);
                    }
                }
            });
        }
    } catch (e) { console.error(e); }

    try {
        const resOficina = await fetch(URL_OFICINAS);
        if (resOficina.ok) {
            let oficinas = await resOficina.json();
            if (!Array.isArray(oficinas) && oficinas.oficinas) oficinas = oficinas.oficinas;
            if (!Array.isArray(oficinas)) oficinas = [oficinas];
            const selectOficina = document.getElementById('empresaParceira');
            oficinas.forEach(o => {
                const item = o.json || o;
                let nomeOficina = item.NOME || item.nome || item.Nome;
                if(nomeOficina) {
                    if (![...selectOficina.options].some(opt => opt.value === nomeOficina)) {
                        let opt = document.createElement('option'); opt.value = nomeOficina; opt.innerText = nomeOficina;
                        selectOficina.appendChild(opt);
                    }
                }
            });
        }
    } catch (e) { console.error(e); }

    carregarHistoricoTabela();
}

async function carregarHistoricoTabela() {
    try {
        const resHist = await fetch(URL_HISTORICO);
        if (!resHist.ok) throw new Error("Erro");
        let dadosBrutos = await resHist.json();
        let listaTratada = [];
        if (Array.isArray(dadosBrutos)) { listaTratada = dadosBrutos; } 
        else if (dadosBrutos && typeof dadosBrutos === 'object') {
            let chaves = ['ordens', 'data', 'rows', 'output', 'body'];
            for (let c of chaves) { if (Array.isArray(dadosBrutos[c])) { listaTratada = dadosBrutos[c]; break; } }
        }
        bancoOrdensCompleto = listaTratada.map(item => item.json || item).filter(item => item && typeof item === 'object');
        
        sincronizarListaFiltradaGlobal();
        paginaAtual = 1;
        renderizarApenasPaginaAtual();
    } catch (e) {
        document.getElementById('dadosHistorico').innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Erro ao carregar dados.</td></tr>`;
    }
}

function sincronizarListaFiltradaGlobal() {
    listaFiltradaGlobal = bancoOrdensCompleto.map((item, index) => {
        let numGravado = obterValorCamaleao(item, ['numero_os', 'numeroos', 'numero-os', 'Nº OS']);
        return { item: item, numeroOS: numGravado ? parseInt(numGravado, 10) : (index + 1) };
    });
    listaFiltradaGlobal.reverse();
}

function renderizarApenasPaginaAtual() {
    const tbody = document.getElementById('dadosHistorico');
    document.getElementById('totalRegistros').innerText = `${listaFiltradaGlobal.length} registros`;
    
    if (listaFiltradaGlobal.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px; color: #888;">Nenhum registro encontrado.</td></tr>`;
        document.getElementById('boxPaginacao').innerHTML = "";
        return;
    }

    tbody.innerHTML = "";

    const indiceInicio = (paginaAtual - 1) * itensPorPagina;
    const indiceFim = indiceInicio + itensPorPagina;
    const subListaExibicao = listaFiltradaGlobal.slice(indiceInicio, indiceFim);

    subListaExibicao.forEach(registro => {
        let item = registro.item;
        let tr = document.createElement('tr');
        tr.setAttribute('onclick', `abrirPopUpAcoes(event, ${registro.numeroOS}, this)`);
        
        let dataOS = obterValorCamaleao(item, ['data', 'dataSolicitacao', 'datasolicitacao']);
        let frotaOS = obterValorCamaleao(item, ['frota', 'prefixo', 'caminhao']);
        let prestadorOS = obterValorCamaleao(item, ['empresaparceira', 'prestador', 'oficina', 'nome']);
        let descOS = construirDescricaoServicos(item);

        tr.innerHTML = `
            <td class="td-check" onclick="event.stopPropagation();"><input type="checkbox" class="os-checkbox" onclick="atualizarContadorSelecionados()"></td>
            <td><span class="badge-os-numero">#${registro.numeroOS}</span></td>
            <td>${dataOS || "---"}</td>
            <td><span class="badge-frota">${frotaOS || "---"}</span></td>
            <td>${(prestadorOS || "---").toUpperCase()}</td>
            <td title="${descOS}">${descOS}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('checkMarcarTodos').checked = false;
    atualizarContadorSelecionados();
    construirBotoesPaginador();
}

function construirBotoesPaginador() {
    const boxPaginacao = document.getElementById('boxPaginacao');
    boxPaginacao.innerHTML = "";
    const totalPaginas = Math.ceil(listaFiltradaGlobal.length / itensPorPagina);
    if (totalPaginas <= 1) return;

    // --- BOTÃO IR PARA O COMEÇO TUDO («) ---
    let btnPrimeira = document.createElement('button');
    btnPrimeira.type = "button";
    btnPrimeira.className = "btn-page";
    btnPrimeira.innerText = "«";
    if (paginaAtual === 1) {
        btnPrimeira.disabled = true;
        btnPrimeira.style.opacity = "0.4";
        btnPrimeira.style.cursor = "not-allowed";
    } else {
        btnPrimeira.onclick = function() {
            paginaAtual = 1;
            renderizarApenasPaginaAtual();
            fecharPopUpAcoes();
        };
    }
    boxPaginacao.appendChild(btnPrimeira);

    // --- BOTÃO ANTERIOR (‹) ---
    let btnAnterior = document.createElement('button');
    btnAnterior.type = "button";
    btnAnterior.className = "btn-page";
    btnAnterior.innerText = "‹";
    if (paginaAtual === 1) {
        btnAnterior.disabled = true;
        btnAnterior.style.opacity = "0.4";
        btnAnterior.style.cursor = "not-allowed";
    } else {
        btnAnterior.onclick = function() {
            paginaAtual--;
            renderizarApenasPaginaAtual();
            fecharPopUpAcoes();
        };
    }
    boxPaginacao.appendChild(btnAnterior);

    // --- CÁLCULO DE INTERVALO DE PÁGINAS VISÍVEIS (MÁXIMO 5) ---
    let maxBotoesVisiveis = 5;
    let inicio = Math.max(1, paginaAtual - Math.floor(maxBotoesVisiveis / 2));
    let fim = inicio + maxBotoesVisiveis - 1;

    if (fim > totalPaginas) {
        fim = totalPaginas;
        inicio = Math.max(1, fim - maxBotoesVisiveis + 1);
    }

    // --- GERAR OS BOTÕES NUMÉRICOS LIMITADOS ---
    for (let i = inicio; i <= fim; i++) {
        let btn = document.createElement('button');
        btn.type = "button";
        btn.className = `btn-page ${i === paginaAtual ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = function() {
            paginaAtual = i;
            renderizarApenasPaginaAtual();
            fecharPopUpAcoes();
        };
        boxPaginacao.appendChild(btn);
    }

    // --- BOTÃO PRÓXIMO (›) ---
    let btnProximo = document.createElement('button');
    btnProximo.type = "button";
    btnProximo.className = "btn-page";
    btnProximo.innerText = "›";
    if (paginaAtual === totalPaginas) {
        btnProximo.disabled = true;
        btnProximo.style.opacity = "0.4";
        btnProximo.style.cursor = "not-allowed";
    } else {
        btnProximo.onclick = function() {
            paginaAtual++;
            renderizarApenasPaginaAtual();
            fecharPopUpAcoes();
        };
    }
    boxPaginacao.appendChild(btnProximo);

    // --- BOTÃO IR PARA O FIM TUDO (») ---
    let btnUltima = document.createElement('button');
    btnUltima.type = "button";
    btnUltima.className = "btn-page";
    btnUltima.innerText = "»";
    if (paginaAtual === totalPaginas) {
        btnUltima.disabled = true;
        btnUltima.style.opacity = "0.4";
        btnUltima.style.cursor = "not-allowed";
    } else {
        btnUltima.onclick = function() {
            paginaAtual = totalPaginas;
            renderizarApenasPaginaAtual();
            fecharPopUpAcoes();
        };
    }
    boxPaginacao.appendChild(btnUltima);
}
// FUNÇÃO PARA CONVERTER STRING "DD/MM/AAAA" EM OBJETO DATE PARA COMPARAÇÃO
function parseDataBR(stringData) {
    if (!stringData) return null;
    const partes = stringData.split('/');
    if (partes.length !== 3) return null;
    // Formato: Ano, Mês (0-11), Dia
    return new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
}

function filtrarHistorico() {
    const fNumero = document.getElementById('filtroNumeroOS').value.trim();
    const fFrota = document.getElementById('filtroFrota').value.toLowerCase();
    const fPrestador = document.getElementById('filtroPrestador').value.toLowerCase();
    const fServico = document.getElementById('filtroServico').value.toLowerCase();
    
    // Captura os valores de data início e fim dos inputs (formato AAAA-MM-DD)
    const dataInicioVal = document.getElementById('filtroDataInicio').value;
    const dataFimVal = document.getElementById('filtroDataFim').value;

    // Converte os limites selecionados para objetos do tipo Date da meia-noite
    const limiteInicio = dataInicioVal ? new Date(dataInicioVal + 'T00:00:00') : null;
    const limiteFim = dataFimVal ? new Date(dataFimVal + 'T23:59:59') : null;

    let listaMapeadaCompleta = bancoOrdensCompleto.map((item, index) => {
        let numGravado = obterValorCamaleao(item, ['numero_os', 'numeroos', 'numero-os', 'Nº OS']);
        return { item: item, numeroOS: numGravado ? parseInt(numGravado, 10) : (index + 1) };
    });
    listaMapeadaCompleta.reverse();

    listaFiltradaGlobal = listaMapeadaCompleta.filter(registro => {
        let item = registro.item;
        let numeroString = registro.numeroOS.toString();
        let frotaTexto = obterValorCamaleao(item, ['frota', 'prefixo', 'caminhao']).toLowerCase();
        let prestadorTexto = obterValorCamaleao(item, ['empresaparceira', 'prestador', 'oficina', 'nome']).toLowerCase();
        let descricaoTexto = construirDescricaoServicos(item).toLowerCase();
        
        // Validação Inteligente de Período
        let atendePeriodo = true;
        let dataRegistroStr = obterValorCamaleao(item, ['data', 'dataSolicitacao', 'datasolicitacao']);
        let dataObjeto = parseDataBR(dataRegistroStr);

        if (dataObjeto) {
            if (limiteInicio && dataObjeto < limiteInicio) atendePeriodo = false;
            if (limiteFim && dataObjeto > limiteFim) atendePeriodo = false;
        } else if (limiteInicio || limiteFim) {
            // Se o registro não tem data válida mas o usuário aplicou um filtro de data, oculta
            atendePeriodo = false;
        }
        
        return (fNumero === "" || numeroString === fNumero) && 
               frotaTexto.includes(fFrota) && 
               prestadorTexto.includes(fPrestador) && 
               descricaoTexto.includes(fServico) &&
               atendePeriodo;
    });

    paginaAtual = 1;
    fecharPopUpAcoes();
    renderizarApenasPaginaAtual();
}

function abrirPopUpAcoes(evento, numeroOS, elementoTr) {
    evento.stopPropagation();
    
    document.querySelectorAll('#dadosHistorico tr').forEach(tr => tr.classList.remove('linha-selecionada'));
    elementoTr.classList.add('linha-selecionada');

    const popup = document.getElementById('popupMenuAcoes');
    popup.style.left = `${evento.clientX + 5}px`;
    popup.style.top = `${evento.clientY + 5}px`;
    popup.style.display = 'block';

    let correspondenciaEncontrada = bancoOrdensCompleto.find((item, index) => {
        let numGravado = obterValorCamaleao(item, ['numero_os', 'numeroos', 'numero-os', 'Nº OS']);
        let numCalculado = numGravado ? parseInt(numGravado, 10) : (index + 1);
        return numCalculado === numeroOS;
    });

    document.getElementById('popupBtnImprimir').onclick = function() {
        if(correspondenciaEncontrada) reimprimirOrdemServicoFisica(numeroOS, correspondenciaEncontrada);
        fecharPopUpAcoes();
    };

    document.getElementById('popupBtnAlterar').onclick = function() {
        alterarOrdemServico(numeroOS); fecharPopUpAcoes();
    };
    
    document.getElementById('popupBtnExcluir').onclick = function() {
        excluirOrdemServico(numeroOS); fecharPopUpAcoes();
    };
}

function reimprimirOrdemServicoFisica(numeroOS, item) {
    let dataOS = obterValorCamaleao(item, ['data', 'dataSolicitacao', 'datasolicitacao']) || "---";
    let frotaOS = obterValorCamaleao(item, ['frota', 'prefixo', 'caminhao']) || "---";
    let prestadorOS = (obterValorCamaleao(item, ['empresaparceira', 'prestador', 'oficina', 'nome']) || "---").toUpperCase();
    
    let s1 = obterValorCamaleao(item, ['Primeiro serviço', 'Primeiro servico', 'servico1', 'serviço1']);
    let s2 = obterValorCamaleao(item, ['Segundo serviço', 'Segundo servico', 'servico2', 'serviço2']);
    let s3 = obterValorCamaleao(item, ['Terceiro serviço', 'Terceiro servico', 'servico3', 'serviço3']);

    let veiculoMemo = dicionarioFrotas[frotaOS] || {};

    document.getElementById('printNumeroOS').innerText = numeroOS;
    document.getElementById('printData').innerText = dataOS;
    document.getElementById('printFrota').innerText = frotaOS;
    document.getElementById('printPlaca').innerText = veiculoMemo.placa || "---";
    document.getElementById('printModelo').innerText = veiculoMemo.modelo || "---";
    document.getElementById('printFilial').innerText = veiculoMemo.filial || "---";
    document.getElementById('printCnpj').innerText = veiculoMemo.cnpj || "---";
    document.getElementById('printOficina').innerText = prestadorOS;
    
    document.getElementById('printServico1').innerText = s1 && s1 !== "---" ? `1º Serviço: ${s1}` : "1º Serviço: Verificar demanda geral";
    document.getElementById('printServico2').innerText = s2 && s2 !== "---" ? `2º Serviço: ${s2}` : "";
    document.getElementById('printServico3').innerText = s3 && s3 !== "---" ? `3º Serviço: ${s3}` : "";

    if(dataOS.includes('/')) {
        const arr = dataOS.split('/');
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        let mExt = meses[parseInt(arr[1], 10) - 1] || "_________________";
        document.getElementById('printDataCidade').innerText = `Cascavel - PR, ${arr[0]} de ${mExt} de 2026.`;
    } else {
        document.getElementById('printDataCidade').innerText = `Cascavel - PR, ____ de _________________ de 2026.`;
    }

    window.print();
}

function alterarOrdemServico(numeroOS) {
    let os = bancoOrdensCompleto.find((item, index) => {
        let numGravado = obterValorCamaleao(item, ['numero_os', 'numeroos', 'numero-os', 'Nº OS']);
        let numCalculado = numGravado ? parseInt(numGravado, 10) : (index + 1);
        return numCalculado === numeroOS;
    });

    if (!os) { alert("Não foi possível localizar os dados desta ordem."); return; }

    osSendoEditada = numeroOS; 

    document.getElementById('selectFrota').value = obterValorCamaleao(os, ['frota', 'prefixo', 'caminhao']);
    document.getElementById('selectFrota').dispatchEvent(new Event('change'));
    document.getElementById('empresaParceira').value = obterValorCamaleao(os, ['empresaparceira', 'prestador', 'oficina', 'nome']);
    document.getElementById('servico1').value = obterValorCamaleao(os, ['Primeiro serviço', 'Primeiro servico', 'servico1', 'serviço1']);
    document.getElementById('servico2').value = obterValorCamaleao(os, ['Segundo serviço', 'Segundo servico', 'servico2', 'serviço2']) || "";
    document.getElementById('servico3').value = obterValorCamaleao(os, ['Terceiro serviço', 'Terceiro servico', 'servico3', 'serviço3']) || "";

    document.getElementById('btnSalvar').querySelector('span').innerText = `Atualizar OS #${numeroOS}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirOrdemServico(numeroOS) {
    const c = confirm(`🗑️ Deseja remover permanentemente do sistema a OS #${numeroOS}?`);
    if(!c) return;
    
    try {
        const response = await fetch(URL_DELETAR, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero_os: numeroOS })
        });
        if(response.ok) {
            alert(`Ordem de serviço #${numeroOS} excluída com sucesso!`);
            carregarHistoricoTabela();
        } else {
            alert("Ocorreu um erro no servidor ao tentar excluir.");
        }
    } catch(e) { alert("Falha na conexão de rede."); }
}

function fecharPopUpAcoes() {
    document.getElementById('popupMenuAcoes').style.display = 'none';
    document.querySelectorAll('#dadosHistorico tr').forEach(tr => tr.classList.remove('linha-selecionada'));
}

document.addEventListener('click', function(e) {
    const popup = document.getElementById('popupMenuAcoes');
    if (popup && popup.style.display === 'block' && !popup.contains(e.target)) fecharPopUpAcoes();
});

function marcarDesmarcarTodos(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.os-checkbox');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    atualizarContadorSelecionados();
}

function atualizarContadorSelecionados() {
    const checkboxes = document.querySelectorAll('.os-checkbox');
    const marcados = Array.from(checkboxes).filter(cb => cb.checked).length;
    document.getElementById('contadorSelecionados').innerText = `(${marcados} selecionadas)`;
}

document.getElementById('selectFrota').addEventListener('change', function() {
    const veiculo = dicionarioFrotas[this.value];
    if (veiculo) {
        document.getElementById('txtPlaca').value = veiculo.placa; document.getElementById('txtModelo').value = veiculo.modelo;
        document.getElementById('txtFilial').value = veiculo.filial; document.getElementById('txtCnpj').value = veiculo.cnpj;
    }
});

async function adicionarFrotaManual() {
    const novaFrota = prompt("Número da Frota (Ex: 2470):"); if (!novaFrota) return;
    const novaPlaca = prompt("Placa:").toUpperCase().trim(); if (!novaPlaca) return;
    const novoModelo = prompt("Modelo:").toUpperCase().trim(); if (!novoModelo) return;
    const novaFilial = prompt("Filial:").toUpperCase().trim(); if (!novaFilial) return;
    const novoCnpj = prompt("CNPJ:").trim(); if (!novoCnpj) return;
    try {
        const response = await fetch(URL_CAD_FROTA, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ FROTA: novaFrota, PLACA: novaPlaca, MODELO: novoModelo, FILIAL: novaFilial, CNPJ: novoCnpj })
        });
        if (response.ok) {
            dicionarioFrotas[novaFrota] = { placa: novaPlaca, modelo: novoModelo, filial: novaFilial, cnpj: novoCnpj };
            const selectFrota = document.getElementById('selectFrota');
            let opt = document.createElement('option'); opt.value = novaFrota; opt.innerText = novaFrota;
            selectFrota.appendChild(opt); selectFrota.value = novaFrota;
            document.getElementById('txtPlaca').value = novaPlaca; document.getElementById('txtModelo').value = novoModelo;
            document.getElementById('txtFilial').value = novaFilial; document.getElementById('txtCnpj').value = novoCnpj;
            alert("Frota adicionada com sucesso!"); carregarHistoricoTabela();
        }
    } catch (err) { alert("Erro de rede."); }
}

async function adicionarOficinaManual() {
    const novaOficina = prompt("Nome da oficina:").toUpperCase().trim(); if (!novaOficina) return;
    try {
        const response = await fetch(URL_CAD_OFICINA, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ NOME: novaOficina })
        });
        if (response.ok) {
            const selectOficina = document.getElementById('empresaParceira');
            let opt = document.createElement('option'); opt.value = novaOficina; opt.innerText = novaOficina;
            selectOficina.appendChild(opt); selectOficina.value = novaOficina;
            alert("Fornecedor cadastrado!");
        }
    } catch (err) { alert("Erro de rede."); }
}

document.getElementById('dataSolicitacao').valueAsDate = new Date();
carregarBancoDeDados();

/* SUBMIT DO FORMULÁRIO (GERENCIA SALVAMENTO E ATUALIZAÇÃO FORÇANDO CAIXA ALTA) */
document.getElementById('osForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSalvar'); const btnText = btn.querySelector('span');
    btnText.innerText = "Registrando..."; btn.disabled = true;

    let dataOriginal = document.getElementById('dataSolicitacao').value;
    let dataFormatadaBR = "", diaStr = "", mesStr = "";
    if (dataOriginal) { const [ano, mes, dia] = dataOriginal.split('-'); diaStr = dia; mesStr = mes; dataFormatadaBR = `${dia}/${mes}/${ano}`; }
    const mesesExtenso = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const mesExtenso = mesesExtenso[parseInt(mesStr, 10) - 1].toUpperCase();
    
    const frotaValor = document.getElementById('selectFrota').value;
    const placaValor = document.getElementById('txtPlaca').value.toUpperCase().trim();
    const modeloValor = document.getElementById('txtModelo').value.toUpperCase().trim();
    const filialValor = document.getElementById('txtFilial').value.toUpperCase().trim();
    const cnpjValor = document.getElementById('txtCnpj').value.trim();
    const txtServico1 = document.getElementById('servico1').value.toUpperCase().trim();
    const txtServico2 = document.getElementById('servico2').value ? document.getElementById('servico2').value.toUpperCase().trim() : "---";
    const txtServico3 = document.getElementById('servico3').value ? document.getElementById('servico3').value.toUpperCase().trim() : "---";
    const fornecedorValor = document.getElementById('empresaParceira').value.toUpperCase().trim();

    const urlDestino = osSendoEditada ? URL_ALTERAR : URL_SALVAR;
    const proximoNumeroOS = osSendoEditada ? osSendoEditada : (bancoOrdensCompleto.length + 1);

    document.getElementById('printNumeroOS').innerText = proximoNumeroOS;
    document.getElementById('printDataCidade').innerText = `CASCAVEL - PR, ${diaStr} DE ${mesExtenso} DE 2026.`;
    document.getElementById('printData').innerText = dataFormatadaBR;
    document.getElementById('printFrota').innerText = frotaValor; document.getElementById('printPlaca').innerText = placaValor;
    document.getElementById('printModelo').innerText = modeloValor; document.getElementById('printFilial').innerText = filialValor;
    document.getElementById('printCnpj').innerText = cnpjValor; document.getElementById('printOficina').innerText = fornecedorValor;
    document.getElementById('printServico1').innerText = `1º SERVIÇO: ${txtServico1}`;
    document.getElementById('printServico2').innerText = txtServico2 !== "---" ? `2º SERVIÇO: ${txtServico2}` : "";
    document.getElementById('printServico3').innerText = txtServico3 !== "---" ? `3º SERVIÇO: ${txtServico3}` : "";

    const payload = { 
        numero_os: proximoNumeroOS,
        dataSolicitacao: dataFormatadaBR, frota: frotaValor, placa: placaValor, modelo: modeloValor, filial: filialValor, cnpj: cnpjValor, 
        empresaParceira: fornecedorValor, servico1: txtServico1, servico2: txtServico2, servico3: txtServico3, 
        descricao: `1º ${txtServico1} | 2º ${txtServico2} | 3º ${txtServico3}`.toUpperCase()
    };

    try {
        const response = await fetch(urlDestino, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (response.ok) {
            alert(osSendoEditada ? "Ordem de Serviço updated com sucesso!" : "Ordem de Serviço registrada com sucesso!");
            window.print();
            
            osSendoEditada = null;
            document.getElementById('btnSalvar').querySelector('span').innerText = "Salvar no Sistema e Imprimir OS";

            document.getElementById('osForm').reset();
            document.getElementById('dataSolicitacao').valueAsDate = new Date();
            document.getElementById('txtPlaca').value = ""; document.getElementById('txtModelo').value = "";
            document.getElementById('txtFilial').value = ""; document.getElementById('txtCnpj').value = "";
            carregarHistoricoTabela();
        }
    } catch (error) { alert("Falha ao salvar no sistema."); }
    finally { btnText.innerText = "Salvar no Sistema e Imprimir OS"; btn.disabled = false; }
});