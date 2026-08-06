/*
  CARIOCA TICKET
  Painel externo do produtor

  Responsabilidades:
  - salvar e testar a URL da API;
  - buscar dados do painel;
  - atualizar automaticamente;
  - preencher cards e gráficos;
  - controlar tela cheia;
  - mostrar último check-in;
  - listar check-ins recentes.
*/


const CHAVE_URL_API =
  'cariocaTicketPainelUrlApi';

const INTERVALO_ATUALIZACAO =
  10000;

const VERSAO_PAINEL =
  'v1.0.0';


let urlApi = '';

let ultimoTimestampRecebido = 0;

let temporizadorAtualizacao = null;

let temporizadorTempo = null;

let carregando = false;


/*
  INICIALIZAÇÃO
*/

document.addEventListener(
  'DOMContentLoaded',
  function() {
    configurarElementos();

    carregarConfiguracao();

    iniciarTemporizadores();

    if (urlApi) {
      carregarPainel();
    } else {
      mostrarConfiguracaoInicial();
    }
  }
);


/*
  CONFIGURA EVENTOS DOS BOTÕES
*/

function configurarElementos() {
  document
    .getElementById(
      'botaoAtualizar'
    )
    .addEventListener(
      'click',
      carregarPainel
    );

  document
    .getElementById(
      'botaoTelaCheia'
    )
    .addEventListener(
      'click',
      alternarTelaCheia
    );

  document
    .getElementById(
      'botaoConfiguracao'
    )
    .addEventListener(
      'click',
      abrirConfiguracao
    );

  document
    .getElementById(
      'botaoTestarApi'
    )
    .addEventListener(
      'click',
      testarConexaoApi
    );

  document
    .getElementById(
      'botaoSalvarApi'
    )
    .addEventListener(
      'click',
      salvarConfiguracaoApi
    );

  document
    .getElementById(
      'campoUrlApi'
    )
    .addEventListener(
      'keydown',
      function(evento) {
        if (
          evento.key ===
          'Enter'
        ) {
          evento.preventDefault();

          salvarConfiguracaoApi();
        }
      }
    );

  document
    .getElementById(
      'modalConfiguracao'
    )
    .addEventListener(
      'close',
      function() {
        document.body.classList.remove(
          'modal-aberto'
        );
      }
    );

  document
    .getElementById(
      'versaoPainel'
    )
    .innerText =
      VERSAO_PAINEL;

  document.addEventListener(
    'fullscreenchange',
    atualizarBotaoTelaCheia
  );
}


/*
  CARREGA A URL SALVA
*/

function carregarConfiguracao() {
  urlApi =
    normalizarUrlApi(
      localStorage.getItem(
        CHAVE_URL_API
      ) || ''
    );

  document
    .getElementById(
      'campoUrlApi'
    )
    .value =
      urlApi;
}


/*
  PRIMEIRA ABERTURA
*/

function mostrarConfiguracaoInicial() {
  alterarCarregamento(false);

  const erro =
    document.getElementById(
      'estadoErro'
    );

  erro.innerHTML =
    '⚙️ Configure a URL da API para iniciar o Painel do Produtor.<br>' +
    '<button ' +
      'type="button" ' +
      'onclick="abrirConfiguracao()" ' +
      'style="' +
        'margin-top:14px;' +
        'padding:11px 18px;' +
        'border:none;' +
        'border-radius:9px;' +
        'background:#111;' +
        'color:#fff;' +
        'font-weight:bold;' +
      '"' +
    '>' +
      'Abrir configuração' +
    '</button>';

  erro.classList.remove(
    'oculto'
  );
}


/*
  TEMPORIZADORES
*/

function iniciarTemporizadores() {
  temporizadorAtualizacao =
    setInterval(
      function() {
        if (
          urlApi &&
          !carregando
        ) {
          carregarPainelSilenciosamente();
        }
      },
      INTERVALO_ATUALIZACAO
    );

  temporizadorTempo =
    setInterval(
      atualizarTempoUltimoCheckin,
      1000
    );
}


/*
  CARREGA O PAINEL
*/

async function carregarPainel() {
  if (!urlApi) {
    mostrarConfiguracaoInicial();
    return;
  }

  if (carregando) {
    return;
  }

  carregando = true;

  alterarCarregamento(true);

  try {
    const dados =
      await buscarDadosPainel();

    validarRespostaApi(
      dados
    );

    preencherPainel(
      dados
    );

    mostrarConteudo();

  } catch (erro) {
    mostrarErro(
      erro.message ||
      'Não foi possível carregar o painel.'
    );

  } finally {
    carregando = false;

    alterarCarregamento(false);
  }
}


/*
  ATUALIZAÇÃO AUTOMÁTICA SEM
  ESCONDER O CONTEÚDO ATUAL
*/

async function carregarPainelSilenciosamente() {
  try {
    const dados =
      await buscarDadosPainel();

    validarRespostaApi(
      dados
    );

    preencherPainel(
      dados
    );

    mostrarConteudo();

  } catch (erro) {
    console.log(
      'Atualização automática não realizada:',
      erro
    );
  }
}


/*
  BUSCA VIA JSONP

  O Apps Script já está preparado para responder
  utilizando o parâmetro callback.
*/

function buscarDadosPainel() {
  return new Promise(
    function(resolve, reject) {
      const nomeCallback =
        '__cariocaPainel_' +
        Date.now() +
        '_' +
        Math.floor(
          Math.random() * 100000
        );

      const script =
        document.createElement(
          'script'
        );

      const temporizador =
        setTimeout(
          function() {
            limparJsonp();

            reject(
              new Error(
                'A API demorou demais para responder.'
              )
            );
          },
          15000
        );

      function limparJsonp() {
        clearTimeout(
          temporizador
        );

        if (
          script.parentNode
        ) {
          script.parentNode.removeChild(
            script
          );
        }

        try {
          delete window[
            nomeCallback
          ];
        } catch (erro) {
          window[
            nomeCallback
          ] = undefined;
        }
      }

      window[
        nomeCallback
      ] = function(dados) {
        limparJsonp();

        resolve(
          dados
        );
      };

      script.onerror =
        function() {
          limparJsonp();

          reject(
            new Error(
              'Não foi possível conectar à API.'
            )
          );
        };

      const separador =
        urlApi.indexOf('?') === -1
          ? '?'
          : '&';

      script.src =
        urlApi +
        separador +
        'action=painel' +
        '&callback=' +
        encodeURIComponent(
          nomeCallback
        ) +
        '&_=' +
        Date.now();

      document.body.appendChild(
        script
      );
    }
  );
}


/*
  VALIDA A RESPOSTA DA API
*/

function validarRespostaApi(
  dados
) {
  if (!dados) {
    throw new Error(
      'A API retornou uma resposta vazia.'
    );
  }

  if (
    dados.sucesso !== true
  ) {
    throw new Error(
      dados.mensagem ||
      'A API não conseguiu carregar os dados.'
    );
  }
}


/*
  PREENCHE TODA A TELA
*/

function preencherPainel(
  dados
) {
  const evento =
    dados.evento || {};

  const resumo =
    dados.resumo || {};

  definirTexto(
    'eventoNome',
    evento.nome ||
    'Evento'
  );

  definirTexto(
    'eventoData',
    '📅 ' +
    (
      evento.data ||
      'Data não informada'
    )
  );

  definirTexto(
    'eventoHorario',
    '🕒 ' +
    (
      evento.horario ||
      'Horário não informado'
    )
  );

  const localCompleto = [
    evento.local || '',
    evento.cidade || '',
    evento.uf || ''
  ]
    .filter(Boolean)
    .join(' — ');

  definirTexto(
    'eventoLocal',
    '📍 ' +
    (
      localCompleto ||
      'Local não informado'
    )
  );

  preencherResumo(
    resumo
  );

  preencherUltimoCheckin(
    dados.ultimoCheckin ||
    null
  );

  preencherCheckinsRecentes(
    dados.checkinsRecentes ||
    []
  );

  preencherBarras(
    resumo
  );

  preencherGrafico(
    dados.checkinsPorHora ||
    []
  );

  definirTexto(
    'textoAtualizacao',
    dados.atualizadoEm ||
    'Agora'
  );
}


/*
  CARDS DE RESUMO
*/

function preencherResumo(
  resumo
) {
  definirTexto(
    'resumoPresentes',
    resumo.presentes || 0
  );

  definirTexto(
    'resumoPendentes',
    resumo.pendentes || 0
  );

  definirTexto(
    'resumoReceita',
    resumo.receita ||
    'R$ 0,00'
  );

  definirTexto(
    'resumoPagos',
    (
      resumo.ingressosPagos || 0
    ) +
    (
      Number(
        resumo.ingressosPagos || 0
      ) === 1
        ? ' ingresso pago'
        : ' ingressos pagos'
    )
  );

  definirTexto(
    'resumoValidos',
    resumo.ingressosValidos ||
    0
  );

  definirTexto(
    'resumoEmitidos',
    (
      resumo.totalIngressos || 0
    ) +
    (
      Number(
        resumo.totalIngressos || 0
      ) === 1
        ? ' ingresso emitido'
        : ' ingressos emitidos'
    )
  );

  definirTexto(
    'resumoTicketMedio',
    resumo.ticketMedio ||
    'R$ 0,00'
  );

  definirTexto(
    'resumoCortesias',
    (
      resumo.cortesias || 0
    ) +
    (
      Number(
        resumo.cortesias || 0
      ) === 1
        ? ' cortesia'
        : ' cortesias'
    )
  );

  definirTexto(
    'resumoCancelados',
    resumo.cancelados ||
    0
  );

  if (
    resumo.capacidadeConfigurada
  ) {
    definirTexto(
      'resumoVagas',
      resumo.vagasRestantes ||
      0
    );

    definirTexto(
      'resumoCapacidade',
      'Capacidade: ' +
      (
        resumo.capacidade || 0
      )
    );

  } else {
    definirTexto(
      'resumoVagas',
      '—'
    );

    definirTexto(
      'resumoCapacidade',
      'Capacidade não configurada'
    );
  }
}


/*
  ÚLTIMO CHECK-IN
*/

function preencherUltimoCheckin(
  item
) {
  const area =
    document.getElementById(
      'ultimoCheckin'
    );

  const icone =
    area.querySelector(
      '.ultimo-icone'
    );

  if (!item) {
    area.classList.add(
      'vazio'
    );

    icone.innerText =
      '—';

    definirTexto(
      'ultimoNome',
      'Nenhum check-in'
    );

    definirTexto(
      'ultimoMensagem',
      'As entradas aparecerão aqui em tempo real.'
    );

    definirTexto(
      'ultimoTipo',
      '—'
    );

    definirTexto(
      'ultimoHorario',
      '—'
    );

    definirTexto(
      'ultimoCodigo',
      '—'
    );

    definirTexto(
      'ultimoTempo',
      '—'
    );

    ultimoTimestampRecebido =
      0;

    return;
  }

  area.classList.remove(
    'vazio'
  );

  icone.innerText =
    '✓';

  definirTexto(
    'ultimoNome',
    item.nome ||
    'Participante'
  );

  definirTexto(
    'ultimoMensagem',
    'Entrada liberada com sucesso'
  );

  definirTexto(
    'ultimoTipo',
    item.tipo ||
    'Não informado'
  );

  definirTexto(
    'ultimoHorario',
    item.horario ||
    '—'
  );

  definirTexto(
    'ultimoCodigo',
    item.codigo ||
    '—'
  );

  ultimoTimestampRecebido =
    Number(
      item.timestamp || 0
    );

  atualizarTempoUltimoCheckin();
}


/*
  LISTA DE CHECK-INS RECENTES
*/

function preencherCheckinsRecentes(
  lista
) {
  const area =
    document.getElementById(
      'listaCheckins'
    );

  if (!lista.length) {
    area.innerHTML =
      '<div class="sem-dados">' +
        'Nenhum check-in registrado.' +
      '</div>';

    return;
  }

  area.innerHTML =
    lista
      .map(
        function(item) {
          return (
            '<div class="checkin-item">' +

              '<div class="checkin-avatar">' +
                escaparHtml(
                  obterIniciais(
                    item.nome
                  )
                ) +
              '</div>' +

              '<div>' +
                '<span class="checkin-nome">' +
                  escaparHtml(
                    item.nome ||
                    'Participante'
                  ) +
                '</span>' +

                '<span class="checkin-detalhes">' +
                  escaparHtml(
                    item.tipo ||
                    'Não informado'
                  ) +

                  (
                    item.codigo
                      ? (
                          ' • ' +
                          escaparHtml(
                            item.codigo
                          )
                        )
                      : ''
                  ) +
                '</span>' +
              '</div>' +

              '<div class="checkin-hora">' +
                escaparHtml(
                  extrairSomenteHora(
                    item.horario
                  )
                ) +
              '</div>' +

            '</div>'
          );
        }
      )
      .join('');
}


/*
  BARRAS DE OCUPAÇÃO E CHECK-IN
*/

function preencherBarras(
  resumo
) {
  const ocupacao =
    limitarPercentual(
      resumo.percentualOcupacao
    );

  const checkin =
    limitarPercentual(
      resumo.percentualCheckin
    );

  definirTexto(
    'percentualOcupacao',
    resumo.capacidadeConfigurada
      ? ocupacao + '%'
      : '—'
  );

  definirTexto(
    'percentualCheckin',
    checkin + '%'
  );

  document
    .getElementById(
      'barraOcupacao'
    )
    .style
    .width =
      resumo.capacidadeConfigurada
        ? ocupacao + '%'
        : '0%';

  document
    .getElementById(
      'barraCheckin'
    )
    .style
    .width =
      checkin + '%';

  definirTexto(
    'textoOcupacao',
    (
      resumo.ingressosValidos || 0
    ) +
    (
      Number(
        resumo.ingressosValidos || 0
      ) === 1
        ? ' ingresso válido'
        : ' ingressos válidos'
    )
  );

  definirTexto(
    'textoVagas',
    resumo.capacidadeConfigurada
      ? (
          (
            resumo.vagasRestantes || 0
          ) +
          (
            Number(
              resumo.vagasRestantes || 0
            ) === 1
              ? ' vaga restante'
              : ' vagas restantes'
          )
        )
      : 'Capacidade não configurada'
  );

  definirTexto(
    'textoCheckin',
    (
      resumo.presentes || 0
    ) +
    ' de ' +
    (
      resumo.ingressosValidos || 0
    ) +
    ' ingressos válidos'
  );
}


/*
  GRÁFICO DE CHECK-INS
*/

function preencherGrafico(
  lista
) {
  const area =
    document.getElementById(
      'graficoCheckins'
    );

  const vazio =
    document.getElementById(
      'semGrafico'
    );

  if (!lista.length) {
    area.innerHTML =
      '';

    area.classList.add(
      'oculto'
    );

    vazio.classList.remove(
      'oculto'
    );

    return;
  }

  area.classList.remove(
    'oculto'
  );

  vazio.classList.add(
    'oculto'
  );

  const maior =
    Math.max.apply(
      null,
      lista.map(
        function(item) {
          return Number(
            item.quantidade || 0
          );
        }
      )
    );

  area.innerHTML =
    lista
      .map(
        function(item) {
          const quantidade =
            Number(
              item.quantidade || 0
            );

          const altura =
            maior > 0
              ? Math.max(
                  4,
                  Math.round(
                    (
                      quantidade /
                      maior
                    ) * 157
                  )
                )
              : 4;

          return (
            '<div class="grafico-item">' +

              '<span class="grafico-valor">' +
                quantidade +
              '</span>' +

              '<div class="grafico-area">' +
                '<div ' +
                  'class="grafico-barra" ' +
                  'style="height:' +
                  altura +
                  'px;"' +
                '>' +
                '</div>' +
              '</div>' +

              '<span class="grafico-legenda">' +
                escaparHtml(
                  item.hora || ''
                ) +
              '</span>' +

            '</div>'
          );
        }
      )
      .join('');
}


/*
  TEMPO DECORRIDO DESDE
  O ÚLTIMO CHECK-IN
*/

function atualizarTempoUltimoCheckin() {
  if (
    !ultimoTimestampRecebido
  ) {
    return;
  }

  const diferencaSegundos =
    Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          ultimoTimestampRecebido
        ) / 1000
      )
    );

  let texto;

  if (
    diferencaSegundos < 10
  ) {
    texto =
      'agora';

  } else if (
    diferencaSegundos < 60
  ) {
    texto =
      'há ' +
      diferencaSegundos +
      ' segundos';

  } else if (
    diferencaSegundos < 3600
  ) {
    const minutos =
      Math.floor(
        diferencaSegundos /
        60
      );

    texto =
      'há ' +
      minutos +
      (
        minutos === 1
          ? ' minuto'
          : ' minutos'
      );

  } else if (
    diferencaSegundos <
    86400
  ) {
    const horas =
      Math.floor(
        diferencaSegundos /
        3600
      );

    texto =
      'há ' +
      horas +
      (
        horas === 1
          ? ' hora'
          : ' horas'
      );

  } else {
    const dias =
      Math.floor(
        diferencaSegundos /
        86400
      );

    texto =
      'há ' +
      dias +
      (
        dias === 1
          ? ' dia'
          : ' dias'
      );
  }

  definirTexto(
    'ultimoTempo',
    texto
  );
}


/*
  MODAL DE CONFIGURAÇÃO
*/

function abrirConfiguracao() {
  const modal =
    document.getElementById(
      'modalConfiguracao'
    );

  document
    .getElementById(
      'campoUrlApi'
    )
    .value =
      urlApi;

  limparMensagemConfiguracao();

  document.body.classList.add(
    'modal-aberto'
  );

  if (
    typeof modal.showModal ===
    'function'
  ) {
    modal.showModal();
  } else {
    modal.setAttribute(
      'open',
      'open'
    );
  }

  setTimeout(
    function() {
      document
        .getElementById(
          'campoUrlApi'
        )
        .focus();
    },
    100
  );
}


/*
  SALVA A URL DA API
*/

async function salvarConfiguracaoApi() {
  const campo =
    document.getElementById(
      'campoUrlApi'
    );

  const novaUrl =
    normalizarUrlApi(
      campo.value
    );

  if (!novaUrl) {
    mostrarMensagemConfiguracao(
      'Informe a URL da API.',
      false
    );

    return;
  }

  if (
    !validarFormatoUrlApi(
      novaUrl
    )
  ) {
    mostrarMensagemConfiguracao(
      'A URL precisa começar com https:// e terminar em /exec.',
      false
    );

    return;
  }

  mostrarMensagemConfiguracao(
    'Testando conexão...',
    true
  );

  const urlAnterior =
    urlApi;

  urlApi =
    novaUrl;

  try {
    const dados =
      await buscarDadosPainel();

    validarRespostaApi(
      dados
    );

    localStorage.setItem(
      CHAVE_URL_API,
      urlApi
    );

    mostrarMensagemConfiguracao(
      'Conexão confirmada. Configuração salva.',
      true
    );

    preencherPainel(
      dados
    );

    mostrarConteudo();

    setTimeout(
      fecharConfiguracao,
      900
    );

  } catch (erro) {
    urlApi =
      urlAnterior;

    mostrarMensagemConfiguracao(
      erro.message ||
      'Não foi possível conectar à API.',
      false
    );
  }
}


/*
  TESTA SEM SALVAR
*/

async function testarConexaoApi() {
  const campo =
    document.getElementById(
      'campoUrlApi'
    );

  const urlTeste =
    normalizarUrlApi(
      campo.value
    );

  if (
    !validarFormatoUrlApi(
      urlTeste
    )
  ) {
    mostrarMensagemConfiguracao(
      'Informe uma URL válida terminada em /exec.',
      false
    );

    return;
  }

  const urlAnterior =
    urlApi;

  urlApi =
    urlTeste;

  mostrarMensagemConfiguracao(
    'Testando conexão...',
    true
  );

  try {
    const dados =
      await buscarDadosPainel();

    validarRespostaApi(
      dados
    );

    mostrarMensagemConfiguracao(
      'Conexão realizada com sucesso.',
      true
    );

  } catch (erro) {
    mostrarMensagemConfiguracao(
      erro.message ||
      'Falha ao conectar.',
      false
    );

  } finally {
    urlApi =
      urlAnterior;
  }
}


/*
  FECHA O MODAL
*/

function fecharConfiguracao() {
  const modal =
    document.getElementById(
      'modalConfiguracao'
    );

  if (
    typeof modal.close ===
    'function'
  ) {
    modal.close();
  } else {
    modal.removeAttribute(
      'open'
    );
  }

  document.body.classList.remove(
    'modal-aberto'
  );
}


/*
  MENSAGENS DO MODAL
*/

function mostrarMensagemConfiguracao(
  mensagem,
  sucesso
) {
  const area =
    document.getElementById(
      'mensagemConfiguracao'
    );

  area.innerText =
    (
      sucesso
        ? '✅ '
        : '❌ '
    ) +
    mensagem;

  area.className =
    'mensagem-configuracao ' +
    (
      sucesso
        ? 'mensagem-sucesso'
        : 'mensagem-erro'
    );
}


function limparMensagemConfiguracao() {
  const area =
    document.getElementById(
      'mensagemConfiguracao'
    );

  area.innerText =
    '';

  area.className =
    'mensagem-configuracao';
}


/*
  TELA CHEIA
*/

async function alternarTelaCheia() {
  try {
    if (
      !document.fullscreenElement
    ) {
      await document
        .documentElement
        .requestFullscreen();

    } else {
      await document
        .exitFullscreen();
    }

  } catch (erro) {
    console.log(
      'Tela cheia indisponível:',
      erro
    );
  }
}


function atualizarBotaoTelaCheia() {
  document
    .getElementById(
      'botaoTelaCheia'
    )
    .innerText =
      document.fullscreenElement
        ? '✕'
        : '⛶';
}


/*
  ESTADOS DA INTERFACE
*/

function alterarCarregamento(
  ativo
) {
  const estado =
    document.getElementById(
      'estadoCarregando'
    );

  const botao =
    document.getElementById(
      'botaoAtualizar'
    );

  botao.disabled =
    ativo;

  if (ativo) {
    estado.classList.remove(
      'oculto'
    );
  } else {
    estado.classList.add(
      'oculto'
    );
  }
}


function mostrarConteudo() {
  document
    .getElementById(
      'conteudoPainel'
    )
    .classList
    .remove(
      'oculto'
    );

  document
    .getElementById(
      'estadoErro'
    )
    .classList
    .add(
      'oculto'
    );
}


function mostrarErro(
  mensagem
) {
  const erro =
    document.getElementById(
      'estadoErro'
    );

  erro.innerHTML =
    '❌ ' +
    escaparHtml(
      mensagem
    ) +
    '<br>' +
    '<button ' +
      'type="button" ' +
      'onclick="abrirConfiguracao()" ' +
      'style="' +
        'margin-top:14px;' +
        'padding:11px 18px;' +
        'border:none;' +
        'border-radius:9px;' +
        'background:#111;' +
        'color:#fff;' +
        'font-weight:bold;' +
      '"' +
    '>' +
      'Verificar configuração' +
    '</button>';

  erro.classList.remove(
    'oculto'
  );
}


/*
  URL DA API
*/

function normalizarUrlApi(
  valor
) {
  let url =
    String(
      valor || ''
    )
      .trim()
      .replace(
        /\s/g,
        ''
      );

  if (!url) {
    return '';
  }

  /*
    Remove parâmetros que o usuário
    eventualmente tenha colado.
  */
  const posicaoInterrogacao =
    url.indexOf('?');

  if (
    posicaoInterrogacao !== -1
  ) {
    url =
      url.substring(
        0,
        posicaoInterrogacao
      );
  }

  /*
    Remove barra extra depois de /exec.
  */
  url =
    url.replace(
      /\/+$/,
      ''
    );

  return url;
}


function validarFormatoUrlApi(
  valor
) {
  const url =
    String(
      valor || ''
    );

  return (
    /^https:\/\/.+\/exec$/i
      .test(
        url
      )
  );
}


/*
  FUNÇÕES AUXILIARES
*/

function limitarPercentual(
  valor
) {
  return Math.max(
    0,
    Math.min(
      100,
      Number(
        valor || 0
      )
    )
  );
}


function extrairSomenteHora(
  texto
) {
  const valor =
    String(
      texto || ''
    );

  const encontrado =
    valor.match(
      /(\d{2}:\d{2}:\d{2})$/
    );

  return encontrado
    ? encontrado[1]
    : valor;
}


function obterIniciais(
  nome
) {
  const partes =
    String(
      nome || ''
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!partes.length) {
    return '?';
  }

  if (
    partes.length === 1
  ) {
    return partes[0]
      .charAt(0)
      .toUpperCase();
  }

  return (
    partes[0]
      .charAt(0) +
    partes[
      partes.length - 1
    ]
      .charAt(0)
  )
    .toUpperCase();
}


function definirTexto(
  id,
  valor
) {
  const elemento =
    document.getElementById(
      id
    );

  if (!elemento) {
    return;
  }

  elemento.innerText =
    valor === null ||
    typeof valor ===
      'undefined'
      ? ''
      : valor;
}


function escaparHtml(
  texto
) {
  return String(
    texto || ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}
