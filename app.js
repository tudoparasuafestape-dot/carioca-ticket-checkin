const CONFIG = {
  STORAGE_API_URL: 'carioca_ticket_api_url',
  VERSAO: '1.0.0',
  TEMPO_BLOQUEIO_LEITURA_MS: 2600,
  TEMPO_LIMPAR_RESULTADO_MS: 3500
};

let leitorQr = null;
let cameraAtiva = false;
let processando = false;
let ultimoCodigo = '';
let ultimoCodigoEm = 0;

const el = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  registrarEventos();
  atualizarEstadoConfiguracao();
  registrarServiceWorker();
});

function registrarEventos() {
  el('btnIniciar').addEventListener('click', iniciarCamera);
  el('btnParar').addEventListener('click', pararCamera);
  el('btnValidar').addEventListener('click', validarCodigoManual);
  el('btnConfig').addEventListener('click', abrirConfiguracao);
  el('btnAbrirConfig').addEventListener('click', abrirConfiguracao);
  el('btnSalvarConfig').addEventListener('click', salvarConfiguracao);
  el('btnTestarConexao').addEventListener('click', testarConexao);

  el('codigoManual').addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') validarCodigoManual();
  });

  window.addEventListener('beforeunload', () => {
    if (leitorQr && cameraAtiva) leitorQr.stop().catch(() => {});
  });
}

function obterApiUrl() {
  return String(localStorage.getItem(CONFIG.STORAGE_API_URL) || '').trim();
}

function atualizarEstadoConfiguracao() {
  const url = obterApiUrl();
  const configurado = url.startsWith('https://') && url.includes('/exec');

  el('avisoConfig').classList.toggle('oculto', configurado);
  el('statusConexao').textContent = configurado ? 'Configurado' : 'Desconectado';
  el('statusConexao').className = configurado
    ? 'badge badge-on'
    : 'badge badge-off';

  if (configurado) el('apiUrl').value = url;
}

function abrirConfiguracao() {
  el('apiUrl').value = obterApiUrl();
  el('mensagemConfig').textContent = '';
  el('modalConfig').showModal();
}

function salvarConfiguracao() {
  const url = String(el('apiUrl').value || '').trim();

  if (!url.startsWith('https://') || !url.includes('/exec')) {
    el('mensagemConfig').textContent =
      '❌ Cole uma URL válida do Apps Script terminada em /exec.';
    return;
  }

  localStorage.setItem(CONFIG.STORAGE_API_URL, url);
  el('mensagemConfig').textContent = '✅ Configuração salva neste aparelho.';
  atualizarEstadoConfiguracao();

  setTimeout(() => el('modalConfig').close(), 700);
}

async function testarConexao() {
  const url = String(el('apiUrl').value || '').trim();

  if (!url.startsWith('https://') || !url.includes('/exec')) {
    el('mensagemConfig').textContent = '❌ Informe primeiro a URL /exec.';
    return;
  }

  el('mensagemConfig').textContent = '⏳ Testando conexão...';

  try {
    const resposta = await chamarApiJsonp(url, {
      action: 'status'
    });

    el('mensagemConfig').textContent = resposta.sucesso
      ? `✅ Conectado: ${resposta.evento || 'Carioca Ticket'}`
      : `❌ ${resposta.mensagem || 'Falha na conexão.'}`;
  } catch (erro) {
    el('mensagemConfig').textContent =
      `❌ Não foi possível conectar: ${erro.message}`;
  }
}

async function iniciarCamera() {
  if (!obterApiUrl()) {
    abrirConfiguracao();
    return;
  }

  limparResultado();
  el('btnIniciar').disabled = true;
  el('btnIniciar').textContent = 'Procurando câmera...';
  el('statusCamera').textContent = 'Permita o acesso quando o navegador solicitar.';

  try {
    const cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      throw new Error('Nenhuma câmera foi encontrada.');
    }

    const camera = escolherCameraTraseira(cameras);
    leitorQr = new Html5Qrcode('reader');

    const largura = Math.max(260, window.innerWidth - 28);
    const tamanho = Math.min(380, Math.max(230, Math.floor(largura * 0.78)));

    await leitorQr.start(
      camera.id,
      {
        fps: 12,
        qrbox: { width: tamanho, height: tamanho },
        aspectRatio: 1
      },
      aoLerQrCode,
      () => {}
    );

    cameraAtiva = true;
    el('btnIniciar').classList.add('oculto');
    el('btnParar').classList.remove('oculto');
    el('btnIniciar').disabled = false;
    el('btnIniciar').textContent = 'Iniciar câmera';
    el('statusCamera').textContent = 'Câmera ativa. Aponte para o QR Code.';
  } catch (erro) {
    cameraAtiva = false;
    leitorQr = null;
    el('btnIniciar').disabled = false;
    el('btnIniciar').textContent = 'Tentar novamente';
    el('statusCamera').textContent = 'Não foi possível abrir a câmera.';

    mostrarResultado({
      tipo: 'erro',
      titulo: 'Câmera não disponível',
      mensagem: normalizarErroCamera(erro),
      codigo: ''
    });
  }
}

function escolherCameraTraseira(cameras) {
  const palavras = ['back', 'rear', 'environment', 'traseira', 'trás'];

  const encontrada = cameras.find((camera) => {
    const nome = String(camera.label || '').toLowerCase();
    return palavras.some((palavra) => nome.includes(palavra));
  });

  return encontrada || cameras[cameras.length - 1];
}

async function pararCamera() {
  if (!leitorQr || !cameraAtiva) {
    restaurarBotoesCamera();
    return;
  }

  el('statusCamera').textContent = 'Desligando câmera...';

  try {
    await leitorQr.stop();
    leitorQr.clear();
  } catch (_) {
  } finally {
    leitorQr = null;
    cameraAtiva = false;
    restaurarBotoesCamera();
    el('statusCamera').textContent = 'Câmera desligada.';
  }
}

function restaurarBotoesCamera() {
  el('btnIniciar').classList.remove('oculto');
  el('btnParar').classList.add('oculto');
  el('btnIniciar').disabled = false;
  el('btnIniciar').textContent = 'Iniciar câmera';
}

function aoLerQrCode(texto) {
  const codigo = extrairCodigo(texto);

  if (!codigo) {
    mostrarResultado({
      tipo: 'erro',
      titulo: 'QR Code inválido',
      mensagem: 'Este QR Code não pertence ao Carioca Ticket.',
      codigo: ''
    });
    return;
  }

  const agora = Date.now();

  if (
    codigo === ultimoCodigo &&
    agora - ultimoCodigoEm < CONFIG.TEMPO_BLOQUEIO_LEITURA_MS
  ) {
    return;
  }

  ultimoCodigo = codigo;
  ultimoCodigoEm = agora;
  validarIngresso(codigo);
}

function validarCodigoManual() {
  const codigo = extrairCodigo(el('codigoManual').value);

  if (!codigo) {
    mostrarResultado({
      tipo: 'erro',
      titulo: 'Código inválido',
      mensagem: 'Digite um código válido, como CT-20260805-3.',
      codigo: ''
    });
    return;
  }

  validarIngresso(codigo);
}

async function validarIngresso(codigo) {
  if (processando) return;

  const apiUrl = obterApiUrl();

  if (!apiUrl) {
    abrirConfiguracao();
    return;
  }

  processando = true;
  el('btnValidar').disabled = true;
  el('btnValidar').textContent = 'Validando...';

  mostrarResultado({
    tipo: 'aviso',
    titulo: 'Validando ingresso',
    mensagem: 'Aguarde a confirmação da planilha.',
    codigo
  });

  try {
    const resposta = await chamarApiJsonp(apiUrl, {
      action: 'checkin',
      codigo
    });

    const tipo = resposta.tipo || (resposta.sucesso ? 'sucesso' : 'erro');

    mostrarResultado({
      tipo,
      titulo:
        tipo === 'sucesso'
          ? 'Entrada liberada'
          : tipo === 'aviso'
            ? 'Atenção'
            : 'Entrada recusada',
      mensagem: resposta.mensagem || 'Operação concluída.',
      codigo: resposta.codigo || codigo,
      nome: resposta.nome || '',
      tipoIngresso: resposta.tipoIngresso || '',
      horario: resposta.horario || ''
    });

    if (tipo === 'sucesso') {
      vibrar([180, 80, 180]);
      tocarSom(880, 180);
    } else if (tipo === 'aviso') {
      vibrar([350, 120, 350]);
      tocarSom(420, 260);
    } else {
      vibrar([600]);
      tocarSom(220, 320);
    }

    el('codigoManual').value = '';
  } catch (erro) {
    mostrarResultado({
      tipo: 'erro',
      titulo: 'Falha na comunicação',
      mensagem: erro.message || 'Não foi possível consultar a planilha.',
      codigo
    });
    vibrar([600]);
  } finally {
    setTimeout(() => {
      processando = false;
      el('btnValidar').disabled = false;
      el('btnValidar').textContent = 'Validar código';
    }, CONFIG.TEMPO_BLOQUEIO_LEITURA_MS);
  }
}

function chamarApiJsonp(apiUrl, parametros) {
  return new Promise((resolve, reject) => {
    const callback = `ctCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');
    const timeout = setTimeout(() => finalizarComErro('Tempo esgotado na conexão.'), 15000);

    function limpar() {
      clearTimeout(timeout);
      delete window[callback];
      script.remove();
    }

    function finalizarComErro(mensagem) {
      limpar();
      reject(new Error(mensagem));
    }

    window[callback] = (dados) => {
      limpar();
      resolve(dados || {});
    };

    const url = new URL(apiUrl);
    Object.entries(parametros).forEach(([chave, valor]) => {
      url.searchParams.set(chave, valor);
    });
    url.searchParams.set('callback', callback);
    url.searchParams.set('_', Date.now());

    script.src = url.toString();
    script.onerror = () => finalizarComErro('O navegador não conseguiu acessar o Apps Script.');
    document.body.appendChild(script);
  });
}

function extrairCodigo(conteudo) {
  const texto = String(conteudo || '').trim().toUpperCase();
  const encontrado = texto.match(/CT-\d{8}-\d+/);

  if (encontrado) return encontrado[0];
  return texto.startsWith('CT-') ? texto : '';
}

function mostrarResultado(dados) {
  const resultado = el('resultado');

  resultado.className = `resultado ${dados.tipo}`;
  resultado.classList.remove('oculto');

  el('resultadoIcone').textContent =
    dados.tipo === 'sucesso' ? '✅' :
    dados.tipo === 'aviso' ? '⚠️' : '❌';

  el('resultadoTitulo').textContent = dados.titulo || '';
  el('resultadoMensagem').textContent = dados.mensagem || '';

  const linhas = [];

  if (dados.nome) linhas.push(`<strong>Participante:</strong> ${escaparHtml(dados.nome)}`);
  if (dados.tipoIngresso) linhas.push(`<strong>Ingresso:</strong> ${escaparHtml(dados.tipoIngresso)}`);
  if (dados.horario) linhas.push(`<strong>Horário:</strong> ${escaparHtml(dados.horario)}`);
  if (dados.codigo) linhas.push(`<strong>Código:</strong> ${escaparHtml(dados.codigo)}`);

  el('resultadoDados').innerHTML = linhas.map((linha) => `<div>${linha}</div>`).join('');

  resultado.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function limparResultado() {
  el('resultado').className = 'resultado oculto';
  el('resultadoIcone').textContent = '';
  el('resultadoTitulo').textContent = '';
  el('resultadoMensagem').textContent = '';
  el('resultadoDados').innerHTML = '';
}

function normalizarErroCamera(erro) {
  const texto = String(erro && (erro.message || erro) || '');

  if (/NotAllowedError|Permission denied/i.test(texto)) {
    return 'Permissão da câmera negada. Abra as permissões deste site e permita o uso da câmera.';
  }

  if (/NotFoundError|Nenhuma câmera/i.test(texto)) {
    return 'Nenhuma câmera foi encontrada neste aparelho.';
  }

  if (/NotReadableError|Could not start/i.test(texto)) {
    return 'A câmera pode estar sendo usada por outro aplicativo. Feche outros apps e tente novamente.';
  }

  return texto || 'Não foi possível abrir a câmera.';
}

function vibrar(padrao) {
  if (navigator.vibrate) navigator.vibrate(padrao);
}

function tocarSom(frequencia, duracao) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const contexto = new AudioCtx();
    const oscilador = contexto.createOscillator();
    const ganho = contexto.createGain();

    oscilador.connect(ganho);
    ganho.connect(contexto.destination);
    oscilador.frequency.value = frequencia;
    ganho.gain.value = 0.10;
    oscilador.start();

    setTimeout(() => {
      oscilador.stop();
      contexto.close();
    }, duracao);
  } catch (_) {
  }
}

function escaparHtml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
