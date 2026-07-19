/* Painel ICM — Indicador de Capacidade Municipal (Defesa Civil / SEDEC-MIDR)
   Fonte: ICM/MIDR apuração 28/04/2026 · malha municipal IBGE 2025.
   Metodologia: Nota Técnica 1/2023 (SEDEC/DAG) e NT 004/2026 (CENAD/Sedec). */
'use strict';

// ---------- paleta ----------
var NAVY='#272F68', LARANJA='#F4A44C';
var COR_FX={A:'#1B7A4B', B:'#7FB069', C:'#F4A44C', D:'#B5482F'};
var COR_SEM='#C9CFDA';
var RAMPA=['#F7E7E3','#F4C9A8','#F4A44C','#7FB069','#1B7A4B']; // pontuação 0-20
var COR_PRIOR='#B5482F', COR_NPRIOR='#5E6AA6';
var ORDEM_FX=['A','B','C','D'];

// Explicação de cada variável, conforme o Anexo da Nota Técnica nº 1/2023
// (questões do formulário de apuração) e a página oficial do ICM.
var VAREXP={
 1:'O Plano Plurianual (PPA) do município inclui programas, projetos ou ações de Proteção e Defesa Civil.',
 2:'O município dispõe de Plano Diretor, aprovado por lei municipal, contemplando os conteúdos de Proteção e Defesa Civil previstos no Estatuto da Cidade (art. 42-A): mapeamento de áreas suscetíveis, intervenção preventiva e realocação de população de áreas de risco, drenagem urbana e diretrizes para áreas verdes.',
 3:'O município dispõe de Plano Municipal de Redução de Riscos.',
 4:'O município dispõe de Carta de Suscetibilidade ou documento equivalente que classifica as áreas do território quanto à possibilidade de ocorrência de movimentos gravitacionais de massa, inundações ou outros desastres.',
 5:'O município dispõe de Carta Geotécnica de Aptidão à Urbanização, que orienta a expansão urbana para áreas seguras.',
 6:'O município dispõe de mapeamento de áreas de risco (elaborado pelo Serviço Geológico do Brasil ou por outras instituições).',
 7:'O município mantém cadastro ou outra forma de identificação das famílias que habitam áreas de risco de desastres.',
 8:'O município dispõe de Plano de Contingência para seca, enchentes ou inundações, enxurradas, escorregamentos ou deslizamentos de encostas.',
 9:'O município conta com Sistema Municipal de Proteção e Defesa Civil (Decreto nº 10.593/2020) ou Conselho Municipal Intersetorial ativo — que se reuniu ou executou atividades no último exercício.',
 10:'O município conta com Coordenação Municipal de Proteção e Defesa Civil (Compdec) ou unidade equivalente instituída formalmente.',
 11:'O município contou, no último exercício, com dotação orçamentária na LOA para programas, projetos ou ações de proteção e defesa civil.',
 12:'Existem Núcleos Comunitários de Proteção e Defesa Civil (Nupdec) ou formas equivalentes de organização comunitária em atividade no município.',
 13:'O município atingiu o número mínimo de pessoas capacitadas em Proteção e Defesa Civil, proporcional à sua população.',
 14:'Ao menos uma pessoa do município é certificada em temática do Plano de Capacitação Continuada da Sedec.',
 15:'O município possui usuário habilitado no Sistema Integrado de Informações sobre Desastres (S2iD).',
 16:'No último ano, o município realizou controle e fiscalização para evitar edificação em áreas suscetíveis, vistoriou edificações e áreas de risco ou promoveu intervenções preventivas.',
 17:'O município possui programa de habitação de interesse social para reassentamento de famílias removidas de áreas de risco ou desabrigadas por desastres (fonte: SNIS).',
 18:'O município executa medidas de drenagem urbana necessárias à prevenção e à mitigação de riscos de desastres (fonte: SNIS).',
 19:'No último ano, o município realizou campanhas ou atividades educativas de conscientização sobre riscos de desastres.',
 20:'O município dispõe de sistema próprio de monitoramento e alerta antecipado para enchentes, inundações, enxurradas ou deslizamentos.'
};

// ---------- estado ----------
// brModo: como o Brasil é desenhado — 'mun' (todos os municípios por faixa) ou 'uf' (por estado)
var S={metric:'faixa', faixa:'todas', nivel:'brasil', brModo:'mun', uf:null, sel:null, base:'Satélite'};
var mapa, camadaUF, camadaMun, camadaMunBR, ufFeats=[], munFeats=[], ufData=null, basemaps;
var munBrData=null, munBrFeats=[];
var META=null, BUSCA=[], chartFaixa, chartPrior, hoverLocal='';

function opacidadeFill(){ return (S.base==='Satélite'||S.base==='Ruas')?0.55:0.85; }
function opacidadeHover(){ return Math.min(0.95, opacidadeFill()+0.28); }
function nfmt(n){ return (n||0).toLocaleString('pt-BR'); }
function pct(n,d){ return d? (100*n/d) : 0; }
function pfmt(n,d){ return d? (Math.round(10*100*n/d)/10).toLocaleString('pt-BR')+'%' : '—'; }
function norm(s){ return (s||'').normalize('NFD').replace(new RegExp('[̀-ͯ]','g'),'').toLowerCase(); }

// ================= carga =================
function erroFatal(msg){
  var el=document.getElementById('load'); el.classList.add('on');
  el.innerHTML='<span style="max-width:470px;text-align:center;line-height:1.5">'+msg+'</span>';
}
if(location.protocol==='file:'){
  erroFatal('<b style="color:#B5482F">Abra por um servidor web</b><br><br>Este painel carrega '+
    'dados e o navegador bloqueia isso em file://.<br><br>Use o atalho <b>abrir_painel.bat</b> '+
    'desta pasta, ou publique no GitHub Pages.');
}
Promise.all([
  fetch('dados/uf.geojson').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }),
  fetch('dados/meta.json').then(function(r){ return r.json(); }),
  fetch('dados/busca.json').then(function(r){ return r.json(); })
]).catch(function(e){
  erroFatal('Falha ao carregar os dados: '+e.message+'.<br>Confirme que a pasta <b>dados/</b> '+
    'está junto do index.html e que o site é servido por HTTP.');
  throw e;
}).then(function(res){
  ufData=res[0]; ufFeats=ufData.features; META=res[1]; BUSCA=res[2];
  iniciaMapa(); bindUI(); desenhaBrasil(); atualiza();
});

// ================= mapa =================
function iniciaMapa(){
  var esri=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19, attribution:'Imagens © Esri, Maxar, Earthstar Geographics'});
  var claro=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {maxZoom:19, subdomains:'abcd', attribution:'© OpenStreetMap · © CARTO'});
  var ruas=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {maxZoom:19, attribution:'© OpenStreetMap'});
  var branco=L.layerGroup();
  basemaps={'Satélite':esri,'Claro':claro,'Ruas':ruas,'Branco (offline)':branco};
  var rotulos=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19, attribution:'Rótulos © Esri'});

  // controles todos à DIREITA (mapa isolado; painéis ficam fora da área do mapa)
  // preferCanvas: o mapa nacional de municípios tem 5.573 polígonos — canvas rende muito melhor
  mapa=L.map('mapa',{zoomControl:false, attributionControl:true, fadeAnimation:false,
    preferCanvas:true, minZoom:3, maxZoom:12, layers:[esri]}).setView([-15,-54],4);
  mapa.attributionControl.setPrefix('ICM/MIDR · IBGE');
  L.control.layers(basemaps,{'Rótulos e limites (satélite)':rotulos},
    {position:'topright',collapsed:true}).addTo(mapa);
  addExportar('topright');                 // caixinha de exportação logo abaixo das camadas
  L.control.zoom({position:'topright'}).addTo(mapa);
  mapa.on('baselayerchange',function(e){ S.base=e.name; reestiliza(); });
  // borda dos municípios do mapa nacional varia com o zoom (cores em destaque no Brasil)
  mapa.on('zoomend',function(){
    if(S.nivel==='brasil'&&S.brModo==='mun'&&camadaMunBR) camadaMunBR.setStyle(estiloMunBR); });
  // escala movida para a DIREITA para liberar o canto inferior esquerdo para a legenda
  L.control.scale({metric:true,imperial:false,position:'bottomright',maxWidth:160}).addTo(mapa);
  addLegenda('bottomleft');                 // legenda dentro do mapa (canto inferior esquerdo)
  addNorte('topright'); addCoordenadas(); addTelaCheia('topright');
  requestAnimationFrame(function(){ mapa.invalidateSize(); });
  setTimeout(function(){ mapa.invalidateSize(); },200);
  window.addEventListener('resize',function(){ mapa.invalidateSize(); });
  document.addEventListener('fullscreenchange',function(){
    setTimeout(function(){ mapa.invalidateSize(); },120); });
}
function addNorte(pos){
  var C=L.Control.extend({options:{position:pos||'topleft'},onAdd:function(){
    var d=L.DomUtil.create('div','leaflet-bar ctl-norte');
    d.innerHTML='<svg viewBox="0 0 40 40"><polygon points="20,4 27,32 20,25 13,32" fill="#272F68"/>'+
      '<polygon points="20,4 20,25 13,32" fill="#F4A44C"/>'+
      '<text x="20" y="39" text-anchor="middle" font-size="10" fill="#272F68" font-weight="700">N</text></svg>';
    return d; }});
  new C().addTo(mapa);
}
function addTelaCheia(pos){
  var C=L.Control.extend({options:{position:pos||'topleft'},onAdd:function(){
    var d=L.DomUtil.create('a','leaflet-bar ctl-btn'); d.href='#'; d.title='Tela cheia'; d.innerHTML='⤢';
    L.DomEvent.on(d,'click',function(e){ L.DomEvent.stop(e);
      var el=document.getElementById('mapa');
      if(!document.fullscreenElement){ (el.requestFullscreen||el.webkitRequestFullscreen).call(el); }
      else document.exitFullscreen(); });
    return d; }});
  new C().addTo(mapa);
}
function addCoordenadas(){
  var C=L.Control.extend({options:{position:'bottomright'},onAdd:function(){
    var d=L.DomUtil.create('div','ctl-coord'); d.id='ctlCoord';
    d.innerHTML='Mova o cursor sobre o mapa'; return d; }});
  new C().addTo(mapa);
  mapa.on('mousemove',function(e){
    var el=document.getElementById('ctlCoord'); if(!el) return;
    el.innerHTML=(hoverLocal?('<b>'+hoverLocal+'</b> · '):'')+
      'lat '+e.latlng.lat.toFixed(4)+' · long '+e.latlng.lng.toFixed(4);
  });
}
// legenda como controle no canto inferior esquerdo do mapa
function addLegenda(pos){
  var C=L.Control.extend({options:{position:pos||'bottomleft'},onAdd:function(){
    var d=L.DomUtil.create('div','leaflet-legenda');
    d.innerHTML='<div class="legenda-in" id="legenda"></div>';
    L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
    return d; }});
  new C().addTo(mapa);
}
// exportação como caixinha (ícone download) logo abaixo do controle de camadas
function addExportar(pos){
  var C=L.Control.extend({options:{position:pos||'topright'},onAdd:function(){
    var d=L.DomUtil.create('div','leaflet-bar leaflet-control exp-ctl');
    d.innerHTML=
      '<a class="exp-toggle" id="btnExportar" href="#" title="Exportar recorte" '+
        'role="button" aria-label="Exportar">⭳</a>'+
      '<div class="exp-panel" id="menuExportar">'+
        '<div class="dd-tit">Recorte atual: <b id="ddRecorte">Brasil</b></div>'+
        '<button data-exp="pdf">📄 Relatório (PDF / impressão)</button>'+
        '<button data-exp="csv">🗒️ Tabela CSV</button>'+
        '<button data-exp="geojson">🌐 GeoJSON</button>'+
        '<button data-exp="kmz">🅚 KMZ (Google Earth)</button>'+
        '<div class="dd-nota" id="ddNota"></div>'+
      '</div>';
    L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
    // atualiza o rótulo do recorte sempre que o cursor entra na caixinha
    L.DomEvent.on(d,'mouseover',function(){ atualizaExport(); });
    return d; }});
  new C().addTo(mapa);
}

// ---------- cores / estilos ----------
var COR_SEMICM='#D6D9DF'; // município sem apuração no ICM
function corMun(p){
  if(p.semICM) return COR_SEMICM;
  if(S.faixa!=='todas' && p.fx!==S.faixa) return COR_SEM;
  if(S.metric==='faixa') return COR_FX[p.fx]||COR_SEM;
  if(S.metric==='prior') return p.grupo==='prioritario'?COR_PRIOR:COR_NPRIOR;
  var t=Math.max(0,Math.min(1,p.tot/20));           // pontuação
  return RAMPA[Math.min(4,Math.floor(t*4.999))];
}
function corUF(p){
  if(S.metric==='faixa') return COR_FX[p.pred]||COR_SEM;
  if(S.metric==='prior'){
    var r=pct(p.prior,p.n_mun);
    return r>=60?COR_PRIOR : r>=35?'#D77E28' : COR_NPRIOR;
  }
  var t=Math.max(0,Math.min(1,(p.media||0)/20));
  return RAMPA[Math.min(4,Math.floor(t*4.999))];
}
function estiloUF(f){
  return {color:'#fff',weight:1,fillColor:corUF(f.properties),fillOpacity:opacidadeFill()};
}
function estiloMun(f){
  var p=f.properties, apaga=(!p.semICM && S.faixa!=='todas' && p.fx!==S.faixa);
  return {color:'#fff',weight:.6,fillColor:corMun(p),
    fillOpacity:apaga?opacidadeFill()*0.35:(p.semICM?Math.min(0.9,opacidadeFill()+0.15):opacidadeFill())};
}
// estilo da camada NACIONAL de municípios: a borda varia com o zoom.
// Na extensão Brasil (zoom baixo) a borda fica da MESMA cor do preenchimento — some
// visualmente e deixa as cores das faixas em destaque, sem a malha branca competindo.
// Ao aproximar, volta uma linha branca fininha para separar os municípios.
function estiloMunBR(f){
  var p=f.properties, apaga=(!p.semICM && S.faixa!=='todas' && p.fx!==S.faixa);
  var fill=corMun(p), z=mapa?mapa.getZoom():4;
  var op=apaga?opacidadeFill()*0.35:(p.semICM?Math.min(0.9,opacidadeFill()+0.15):opacidadeFill());
  var borda = z>=8 ? {color:'#fff',weight:.5} : z>=6 ? {color:'#fff',weight:.25} : {color:fill,weight:.35};
  return {color:borda.color,weight:borda.weight,fillColor:fill,fillOpacity:op};
}
function reestiliza(){
  if(S.nivel==='uf'&&camadaMun) camadaMun.setStyle(estiloMun);
  else if(S.nivel==='brasil'&&S.brModo==='mun'&&camadaMunBR) camadaMunBR.setStyle(estiloMunBR);
  else if(camadaUF) camadaUF.setStyle(estiloUF);
}

// ---------- camadas ----------
function limpaCamadasBrasil(){
  if(camadaMun){ mapa.removeLayer(camadaMun); camadaMun=null; }
  if(camadaUF){ mapa.removeLayer(camadaUF); camadaUF=null; }
  if(camadaMunBR){ mapa.removeLayer(camadaMunBR); camadaMunBR=null; }
}
// desenha o Brasil conforme o modo escolhido (municípios por faixa ou estados)
function desenhaBrasil(){
  if(S.brModo==='uf') desenhaUF();
  else desenhaMunBrasil();
}
// visão nacional por MUNICÍPIO (todos os municípios do país, coloridos pela faixa do ICM)
function desenhaMunBrasil(){
  limpaCamadasBrasil();
  if(!munBrData){
    loading(true);
    fetch('dados/mun_brasil.geojson').then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status); return r.json();
    }).then(function(gj){
      munBrData=gj; munBrFeats=gj.features; loading(false);
      if(S.nivel==='brasil' && S.brModo==='mun') pintaMunBrasil();
    }).catch(function(e){
      loading(false);
      erroFatal('Falha ao carregar o mapa nacional de municípios: '+e.message+'.');
    });
    return;
  }
  pintaMunBrasil();
}
function pintaMunBrasil(){
  if(camadaMunBR){ mapa.removeLayer(camadaMunBR); camadaMunBR=null; }
  camadaMunBR=L.geoJSON(munBrData,{style:estiloMunBR,onEachFeature:function(f,l){
    l._cd=f.properties.cd;
    l.on({
      mouseover:function(){ l.setStyle({weight:1.4,color:LARANJA,fillOpacity:opacidadeHover()});
        l.bringToFront(); hoverLocal=f.properties.nm+' — '+f.properties.uf; tipMun(f,l); },
      mouseout:function(){ camadaMunBR.resetStyle(l); l.closeTooltip(); hoverLocal=''; },
      click:function(){ entraUF(f.properties.uf, f.properties.cd); }
    });
  }}).addTo(mapa);
  mapa.setView([-15,-54],4);
}
function desenhaUF(){
  limpaCamadasBrasil();
  camadaUF=L.geoJSON(ufData,{style:estiloUF,onEachFeature:function(f,l){
    l.on({
      mouseover:function(){ l.setStyle({weight:2.5,color:LARANJA,fillOpacity:opacidadeHover()});
        l.bringToFront(); hoverLocal=f.properties.nm; tipUF(f,l); },
      mouseout:function(){ camadaUF.resetStyle(l); l.closeTooltip(); hoverLocal=''; },
      click:function(){ entraUF(f.properties.uf); }
    });
  }}).addTo(mapa);
  mapa.setView([-15,-54],4);
}
function entraUF(uf,focoCd){
  S.nivel='uf'; S.uf=uf; S.sel=null; loading(true); fechaDetalhe();
  fetch('dados/mun/'+uf+'.geojson').then(function(r){ return r.json(); }).then(function(gj){
    munFeats=gj.features;
    limpaCamadasBrasil();
    camadaMun=L.geoJSON(gj,{style:estiloMun,onEachFeature:function(f,l){
      l._cd=f.properties.cd;
      l.on({
        mouseover:function(){ l.setStyle({weight:2,color:LARANJA,fillOpacity:opacidadeHover()});
          l.bringToFront(); hoverLocal=f.properties.nm+' — '+f.properties.uf; tipMun(f,l); },
        mouseout:function(){ if(S.sel!==f.properties.cd) camadaMun.resetStyle(l);
          l.closeTooltip(); hoverLocal=''; },
        click:function(){ selecionaMun(f.properties.cd); }
      });
    }}).addTo(mapa);
    // ES: enquadra só a porção continental (exclui Trindade/Martim Vaz, sem tirar do dado)
    var bUF=(uf==='ES'&&boundsLLcont(munFeats))||camadaMun.getBounds();
    mapa.fitBounds(bUF,{padding:[20,20]});
    loading(false); atualiza();
    if(focoCd) selecionaMun(focoCd);
    else { var u=ufFeats.find(function(f){ return f.properties.uf===uf; });
           if(u) abreDetalheUF(u.properties); }
  });
}
function voltaBrasil(){
  S.nivel='brasil'; S.uf=null; S.sel=null; fechaDetalhe();
  desenhaBrasil(); atualiza();
}
function selecionaMun(cd){
  S.sel=cd;
  var alvo=null;
  camadaMun.eachLayer(function(l){
    if(l._cd===cd){ alvo=l; l.setStyle({weight:3,color:NAVY,fillOpacity:opacidadeHover()});
      l.bringToFront(); }
    else camadaMun.resetStyle(l);
  });
  var p=munFeats.find(function(f){ return f.properties.cd===cd; });
  // Vitória-ES tem Trindade/Martim Vaz: enquadra só a porção continental (fallback se for ilha oceânica)
  var bMun=(p&&boundsLLcont([p]))||(alvo&&alvo.getBounds());
  if(bMun) mapa.fitBounds(bMun,{padding:[70,70],maxZoom:10});
  if(p) abreDetalhe(p.properties);
  listaLocais(); narrativa();
}

// ---------- tooltips ----------
function tipUF(f,l){
  var p=f.properties, t=p.n_mun;
  var h='<div class="tt-n">'+p.nm+'</div><div class="l">'+p.rg+' · '+nfmt(t)+' municípios</div>'+
    '<table>';
  ORDEM_FX.forEach(function(fx){
    h+='<tr><td>Faixa '+fx+'</td><td><b>'+nfmt(p['f'+fx])+'</b> ('+pfmt(p['f'+fx],t)+')</td></tr>';
  });
  h+='<tr><td>Predominante</td><td><b>'+p.pred+'</b></td></tr>'+
     '<tr><td>Pontuação média municipal</td><td><b>'+(p.media||0).toLocaleString('pt-BR')+'</b>/20</td></tr>'+
     '<tr><td>Prioritários</td><td><b>'+nfmt(p.prior)+'</b> ('+pfmt(p.prior,t)+')</td></tr></table>'+
     '<div class="l" style="margin-top:5px">Clique para ver os municípios</div>';
  l.bindTooltip(h,{className:'tt',sticky:true}).openTooltip();
}
function popfmt(v){ return (v==null)?'—':nfmt(v)+' hab.'; }
function tipMun(f,l){
  var p=f.properties, h;
  if(p.semICM){
    h='<div class="tt-n">'+p.nm+' — '+p.uf+'</div>'+
      '<div class="l">'+p.rg+' · '+popfmt(p.pop)+'</div>'+
      '<div style="margin-top:5px"><b style="color:#F4A44C">Sem informação no ICM</b><br>'+
      '<span class="l">Município ainda não apurado no indicador.</span></div>';
    l.bindTooltip(h,{className:'tt',sticky:true}).openTooltip(); return;
  }
  h='<div class="tt-n">'+p.nm+' — '+p.uf+'</div>'+
    '<div class="l">'+p.gLbl+'</div><table>'+
    '<tr><td>Faixa ICM</td><td><b>'+p.fx+'</b> — '+META.faixas[p.fx]+'</td></tr>'+
    '<tr><td>Pontuação</td><td><b>'+p.tot+'</b>/20</td></tr>'+
    '<tr><td>Dim. I — Planejamento</td><td><b>'+p.d1+'</b>/8</td></tr>'+
    '<tr><td>Dim. II — Coordenação</td><td><b>'+p.d2+'</b>/7</td></tr>'+
    '<tr><td>Dim. III — Políticas</td><td><b>'+p.d3+'</b>/5</td></tr>'+
    '<tr><td>Porte</td><td>'+p.porte+'</td></tr>'+
    '<tr><td>Perfil de risco</td><td>'+p.risco+'</td></tr>'+
    '<tr><td>População</td><td>'+popfmt(p.pop)+'</td></tr></table>'+
    '<div class="l" style="margin-top:5px">Clique para abrir a ficha completa</div>';
  l.bindTooltip(h,{className:'tt',sticky:true}).openTooltip();
}

// ================= agregação =================
function escopo(){ return S.nivel==='uf'?munFeats:ufFeats; }
function resumo(){
  var r={n:0, fx:{A:0,B:0,C:0,D:0}, prior:0, soma:0};
  if(S.nivel==='uf'){
    munFeats.forEach(function(f){ var p=f.properties; if(p.semICM) return;
      r.n++; r.fx[p.fx]++; r.soma+=p.tot; if(p.grupo==='prioritario') r.prior++; });
  } else {
    ufFeats.forEach(function(f){ var p=f.properties;
      r.n+=p.n_mun; ORDEM_FX.forEach(function(k){ r.fx[k]+=p['f'+k]; });
      r.prior+=p.prior; r.soma+=(p.media||0)*p.n_mun; });
  }
  r.media=r.n?Math.round(10*r.soma/r.n)/10:0;
  return r;
}
function resumoBrasil(){
  var r={n:0,fx:{A:0,B:0,C:0,D:0},prior:0,soma:0};
  ufFeats.forEach(function(f){ var p=f.properties;
    r.n+=p.n_mun; ORDEM_FX.forEach(function(k){ r.fx[k]+=p['f'+k]; });
    r.prior+=p.prior; r.soma+=(p.media||0)*p.n_mun; });
  r.media=r.n?Math.round(10*r.soma/r.n)/10:0;
  return r;
}
function resumoRegiao(nomeRg){
  var r={n:0,fx:{A:0,B:0,C:0,D:0},soma:0};
  ufFeats.forEach(function(f){ var p=f.properties; if(p.rg!==nomeRg) return;
    r.n+=p.n_mun; ORDEM_FX.forEach(function(k){ r.fx[k]+=p['f'+k]; });
    r.soma+=(p.media||0)*p.n_mun; });
  r.media=r.n?Math.round(10*r.soma/r.n)/10:0;
  return r;
}

// ================= UI =================
function atualiza(){
  document.querySelectorAll('#segMetric button').forEach(function(b){ b.classList.toggle('on',b.dataset.v===S.metric); });
  document.querySelectorAll('#segFaixa button').forEach(function(b){ b.classList.toggle('on',b.dataset.v===S.faixa); });
  document.querySelectorAll('#segBrModo button').forEach(function(b){ b.classList.toggle('on',b.dataset.v===S.brModo); });
  // o seletor Municípios/Estados só faz sentido no panorama nacional
  var grp=document.getElementById('grpBrModo'); if(grp) grp.style.display=(S.nivel==='brasil')?'':'none';
  document.getElementById('btnVoltar').disabled=(S.nivel!=='uf');
  var mig=document.getElementById('migalha');
  if(S.nivel==='uf'){
    var u=ufFeats.find(function(f){ return f.properties.uf===S.uf; }).properties;
    mig.innerHTML='<b>Brasil</b> › <b>'+u.nm+'</b> · '+nfmt(u.n_mun)+' municípios';
    document.getElementById('escopoNome').textContent=u.nm;
    document.getElementById('escopoSub').textContent=nfmt(u.n_mun)+' municípios · '+u.rg;
  } else {
    mig.innerHTML='<b>Brasil</b> · 27 UFs';
    document.getElementById('escopoNome').textContent='Brasil';
    document.getElementById('escopoSub').textContent='5.570 municípios · 27 UFs';
  }
  reestiliza(); legenda(); cards(); graficoFaixa(); graficoPrior(); listaLocais(); rodape();
  narrativa();
}

// ================= narrativa automática (gerada por regras) =================
function fxNome(fx){ return '<span class="fx" style="color:'+COR_FX[fx]+'">'+fx+' ('+
  META.faixas[fx]+')</span>'; }
function narrativa(){
  var tit=document.getElementById('narTit'), corpo=document.getElementById('narCorpo'), h='';
  if(S.sel){                                    // ---- MUNICÍPIO ----
    var p=munFeats.find(function(f){ return f.properties.cd===S.sel; });
    p=p&&p.properties;
    if(p&&p.semICM){ tit.textContent=p.nm+' — '+p.uf;
      h='<p><b>'+p.nm+'</b> ('+p.uf+') ainda <b>não possui apuração no ICM</b> e aparece em '+
        'cinza no mapa. População estimada de '+popfmt(p.pop)+'.</p>';
    } else if(p){
      tit.textContent=p.nm+' — '+p.uf;
      var uf=ufFeats.find(function(f){ return f.properties.uf===p.uf; }).properties;
      h='<p><b>'+p.nm+'</b> está na faixa '+fxNome(p.fx)+', com <b>'+p.tot+' de 20</b> pontos, '+
        'classificado como <b>'+p.gLbl.toLowerCase()+'</b> (população '+popfmt(p.pop)+').</p>';
      h+='<p>Por dimensão: Planejamento '+p.d1+'/8, Coordenação '+p.d2+'/7, Políticas '+p.d3+'/5. '+
        'A média de '+p.uf+' é '+uf.media.toLocaleString('pt-BR')+'/20.</p>';
      if(p.falta){ var f=p.falta, faltam=[];
        [['Planejamento',f.I],['Coordenação',f.II],['Políticas',f.III]].forEach(function(x){
          if(x[1]>0) faltam.push(x[1]+' em '+x[0]); });
        h+='<div class="nar-destaque">Para avançar à faixa '+fxNome(f.alvo)+', '+
          (faltam.length?('faltam '+faltam.join(', ')+'.'):'basta consolidar os instrumentos '+
          'mínimos exigidos.')+' Veja a aba <b>Como avançar</b>.</div>';
      } else { h+='<div class="nar-destaque">Já está na faixa máxima (A) do indicador.</div>'; }
    }
  } else if(S.nivel==='uf'){                     // ---- UF ----
    var u=ufFeats.find(function(f){ return f.properties.uf===S.uf; }).properties;
    var br=resumoBrasil(), cd=u.fC+u.fD, cdBr=br.fx.C+br.fx.D;
    var melhorFx=ORDEM_FX.slice().sort(function(a,b){ return u['f'+b]-u['f'+a]; })[0];
    tit.textContent=u.nm+' — panorama ICM';
    h='<p><b>'+u.nm+'</b> ('+u.rg+') reúne <b>'+nfmt(u.n_mun)+'</b> municípios, '+
      popfmt(u.pop)+' e '+nfmt(u.area)+' km². A faixa predominante é '+fxNome(u.pred)+
      ' e a pontuação média municipal é <b>'+u.media.toLocaleString('pt-BR')+'/20</b>.</p>';
    h+='<p>Distribuição: '+ORDEM_FX.map(function(fx){ return '<b>'+fx+'</b> '+
      pfmt(u['f'+fx],u.n_mun); }).join(' · ')+'.</p>';
    var comp=pct(cd,u.n_mun)>=pct(cdBr,br.n)?'acima':'abaixo';
    h+='<div class="nar-destaque"><b>'+pfmt(cd,u.n_mun)+'</b> dos municípios estão em estágio '+
      'inicial (faixas C+D), '+comp+' da média nacional ('+pfmt(cdBr,br.n)+'). '+
      nfmt(u.prior)+' municípios ('+pfmt(u.prior,u.n_mun)+') são prioritários. '+
      'Abra o painel <b>20 variáveis (UF)</b> para ver quais instrumentos são mais escassos.</div>';
  } else {                                       // ---- BRASIL ----
    var b=resumoBrasil();
    var cdB=b.fx.C+b.fx.D;
    var ufsOrd=ufFeats.slice().sort(function(a,x){ return x.properties.media-a.properties.media; });
    var top=ufsOrd[0].properties, bot=ufsOrd[ufsOrd.length-1].properties;
    tit.textContent='Panorama nacional do ICM';
    h='<p>O <b>Indicador de Capacidade Municipal</b> avalia a capacidade de <b>'+nfmt(b.n)+
      '</b> municípios brasileiros na gestão de riscos e desastres, em quatro faixas.</p>';
    h+='<p>Distribuição nacional: '+ORDEM_FX.map(function(fx){ return '<b>'+fx+'</b> '+
      pfmt(b.fx[fx],b.n)+' ('+nfmt(b.fx[fx])+')'; }).join(' · ')+'.</p>';
    h+='<div class="nar-destaque"><b>'+pfmt(cdB,b.n)+'</b> dos municípios ('+nfmt(cdB)+') estão em '+
      'estágio inicial de capacidade (faixas C e D) — o principal desafio. '+nfmt(b.prior)+
      ' municípios ('+pfmt(b.prior,b.n)+') são <b>prioritários</b> (maior risco de desastres).</div>';
    h+='<p style="margin-top:7px">Maior média estadual: <b>'+top.nm+'</b> ('+
      top.media.toLocaleString('pt-BR')+'/20). Menor: <b>'+bot.nm+'</b> ('+
      bot.media.toLocaleString('pt-BR')+'/20). Clique num estado no mapa para detalhar.</p>';
  }
  corpo.innerHTML=h;
  atualizaSetasPaineis();
}

function cards(){
  var r=resumo(), br=resumoBrasil(), h='';
  h+=kpi(nfmt(r.n),'Municípios no recorte');
  h+=kpi(r.media.toLocaleString('pt-BR')+'<span style="font-size:12px;color:#8A9099">/20</span>',
        'Pontuação média');
  // faixas com pílulas
  var fh='';
  ORDEM_FX.forEach(function(fx){
    fh+='<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0">'+
      '<span class="pill p'+fx+'">'+fx+'</span>'+
      '<span style="font-size:11.5px;color:#5B6068">'+META.faixas[fx]+'</span>'+
      '<b style="font-size:12.5px">'+nfmt(r.fx[fx])+' · '+pfmt(r.fx[fx],r.n)+'</b></div>';
  });
  h+='<div class="kpi full"><div class="r" style="margin:0 0 4px">Distribuição por faixa</div>'+fh+'</div>';
  // comparativo C+D (estágio embrionário) UF x região x Brasil
  var cdR=r.fx.C+r.fx.D;
  var comp='<div style="display:flex;justify-content:space-between;padding:2px 0">'+
    '<span style="font-size:11.5px;color:#5B6068">'+(S.nivel==='uf'?'Nesta UF':'Brasil')+'</span>'+
    '<b style="font-size:12.5px">'+pfmt(cdR,r.n)+'</b></div>';
  if(S.nivel==='uf'){
    var u=ufFeats.find(function(f){ return f.properties.uf===S.uf; }).properties;
    var rg=resumoRegiao(u.rg), cdRg=rg.fx.C+rg.fx.D, cdBr=br.fx.C+br.fx.D;
    comp+='<div style="display:flex;justify-content:space-between;padding:2px 0">'+
      '<span style="font-size:11.5px;color:#5B6068">Região '+u.rg+'</span>'+
      '<b style="font-size:12.5px">'+pfmt(cdRg,rg.n)+'</b></div>'+
      '<div style="display:flex;justify-content:space-between;padding:2px 0">'+
      '<span style="font-size:11.5px;color:#5B6068">Brasil</span>'+
      '<b style="font-size:12.5px">'+pfmt(cdBr,br.n)+'</b></div>';
  }
  h+='<div class="kpi full"><div class="r" style="margin:0 0 4px">Em estágio inicial (faixas C+D)</div>'+comp+'</div>';
  document.getElementById('kpis').innerHTML=h;
}
function kpi(v,r,cls){ return '<div class="kpi'+(cls?' '+cls:'')+'"><div class="v">'+v+'</div><div class="r">'+r+'</div></div>'; }

function graficoFaixa(){
  if(!chartFaixa) chartFaixa=echarts.init(document.getElementById('chartFaixa'));
  var r=resumo();
  // ordem natural da escala (A no topo -> D embaixo): ECharts inverte o eixo Y
  var cats=ORDEM_FX.slice().reverse();
  var dados=cats.map(function(fx){
    return {value:r.fx[fx], itemStyle:{color:COR_FX[fx]}, fx:fx};
  });
  chartFaixa.setOption({
    grid:{left:4,right:70,top:4,bottom:2,containLabel:true},
    xAxis:{type:'value',axisLabel:{show:false},splitLine:{show:false},axisTick:{show:false}},
    yAxis:{type:'category',data:cats.map(function(f){ return f+' — '+META.faixas[f]; }),
      axisLabel:{fontSize:11,color:'#5B6068'},axisLine:{show:false},axisTick:{show:false}},
    tooltip:{trigger:'item',formatter:function(o){
      return 'Faixa '+cats[o.dataIndex]+'<br><b>'+nfmt(o.value)+'</b> municípios ('+pfmt(o.value,r.n)+')'; }},
    series:[{type:'bar',data:dados,barWidth:'64%',
      label:{show:true,position:'right',fontSize:11,color:'#22252E',fontWeight:500,
        formatter:function(o){ return nfmt(o.value)+'  ·  '+pfmt(o.value,r.n); }}}]
  });
  document.getElementById('dicaFaixa').textContent=
    'Total do recorte: '+nfmt(r.n)+' municípios. Faixas conforme metodologia oficial (porte e perfil de risco).';
}

function graficoPrior(){
  if(!chartPrior) chartPrior=echarts.init(document.getElementById('chartPrior'));
  var r=resumo(), np=r.n-r.prior;
  chartPrior.setOption({
    grid:{left:4,right:8,top:4,bottom:4,containLabel:true},
    xAxis:{type:'value',show:false,max:r.n},
    yAxis:{type:'category',data:[''],show:false},
    tooltip:{trigger:'item',formatter:function(o){
      return o.seriesName+'<br><b>'+nfmt(o.value)+'</b> ('+pfmt(o.value,r.n)+')'; }},
    legend:{show:true,bottom:0,itemWidth:9,itemHeight:9,textStyle:{fontSize:10.5,color:'#5B6068'}},
    series:[
      {name:'Prioritários',type:'bar',stack:'t',data:[r.prior],itemStyle:{color:COR_PRIOR},
       barWidth:20,label:{show:r.prior>0,position:'inside',fontSize:10.5,color:'#fff',fontWeight:700,
         formatter:function(){ return nfmt(r.prior)+' · '+pfmt(r.prior,r.n); }}},
      {name:'Não prioritários',type:'bar',stack:'t',data:[np],itemStyle:{color:COR_NPRIOR},
       barWidth:20,label:{show:np>0,position:'inside',fontSize:10.5,color:'#fff',fontWeight:700,
         formatter:function(){ return nfmt(np)+' · '+pfmt(np,r.n); }}}
    ]
  });
}

// ---------- lista (UFs ou municípios) ----------
function listaLocais(){
  var tit=document.getElementById('listaTit'), body=document.getElementById('listaBody'), h='';
  if(S.nivel==='brasil'){
    tit.textContent='Unidades da Federação (27)';
    document.getElementById('thFaixa').textContent='Predom.';
    document.getElementById('thPontos').textContent='Média';
    document.getElementById('listaDica').innerHTML='<b>Leituras derivadas deste painel:</b> a '+
      'metodologia oficial atribui faixa e pontuação (0–20) apenas a municípios. Por UF, '+
      '<b>Predom.</b> é a faixa mais frequente entre os municípios do estado e <b>Média</b> é a '+
      'pontuação média municipal (0–20). Clique na UF para ver os municípios.';
    var arr=ufFeats.slice().sort(function(a,b){ return b.properties.media-a.properties.media; });
    arr.forEach(function(f,i){
      var p=f.properties;
      h+='<tr data-uf="'+p.uf+'"><td class="pos">'+(i+1)+'</td>'+
        '<td>'+p.nm+' <span style="color:#8A9099">('+p.uf+')</span></td>'+
        '<td class="c"><span class="pill p'+p.pred+'" title="Faixa predominante">'+p.pred+'</span></td>'+
        '<td class="n">'+(p.media||0).toLocaleString('pt-BR')+'</td></tr>';
    });
  } else {
    tit.textContent='Municípios — ranking por faixa e pontos';
    document.getElementById('thFaixa').textContent='Faixa';
    document.getElementById('thPontos').textContent='Pontos';
    document.getElementById('listaDica').textContent='Ranqueado por faixa (A→D) e, dentro '+
      'da faixa, pela pontuação (0–20). Clique para focar e abrir a ficha do município.';
    var ordem={A:0,B:1,C:2,D:3};
    var ms=munFeats.slice().sort(function(a,b){
      var pa=a.properties, pb=b.properties;
      if(pa.semICM!==pb.semICM) return pa.semICM?1:-1;   // sem ICM por último
      if(pa.semICM) return pa.nm.localeCompare(pb.nm);
      var d=ordem[pa.fx]-ordem[pb.fx];
      if(d) return d;
      return pb.tot-pa.tot;
    });
    ms.forEach(function(f,i){
      var p=f.properties;
      if(p.semICM){
        h+='<tr data-cd="'+p.cd+'"'+(S.sel===p.cd?' class="sel"':'')+' style="opacity:.7">'+
          '<td class="pos">'+(i+1)+'</td><td>'+p.nm+'</td>'+
          '<td class="c"><span class="pill" style="background:'+COR_SEMICM+';color:#5B6068" '+
          'title="Sem informação no ICM">s/inf</span></td><td class="n">—</td></tr>';
        return;
      }
      var dim=(S.faixa!=='todas'&&p.fx!==S.faixa)?' style="opacity:.35"':'';
      h+='<tr data-cd="'+p.cd+'"'+(S.sel===p.cd?' class="sel"':'')+dim+'>'+
        '<td class="pos">'+(i+1)+'</td><td>'+p.nm+'</td>'+
        '<td class="c"><span class="pill p'+p.fx+'">'+p.fx+'</span></td>'+
        '<td class="n">'+p.tot+'</td></tr>';
    });
  }
  body.innerHTML=h;
  body.querySelectorAll('tr').forEach(function(tr){
    tr.onclick=function(){
      if(tr.dataset.uf) entraUF(tr.dataset.uf);
      else selecionaMun(tr.dataset.cd);
    };
  });
  var lw=document.querySelector('.lista-wrap'); if(lw){ lw.scrollTop=0; atualizaSetaScroll(lw); }
}

// ---------- busca ----------
function bindBusca(){
  var inp=document.getElementById('busca'), res=document.getElementById('buscaRes');
  inp.addEventListener('input',function(){
    var q=norm(inp.value.trim());
    if(q.length<2){ res.classList.remove('on'); return; }
    var out=[];
    ufFeats.forEach(function(f){ var p=f.properties;
      if(norm(p.nm).indexOf(q)===0||p.uf.toLowerCase()===q)
        out.push({tipo:'uf',uf:p.uf,nm:p.nm,extra:'UF · faixa '+p.pred});
    });
    for(var i=0;i<BUSCA.length&&out.length<40;i++){
      if(BUSCA[i].k.indexOf(q)===0)
        out.push({tipo:'mun',cd:BUSCA[i].cd,uf:BUSCA[i].uf,nm:BUSCA[i].nm,
          extra:BUSCA[i].uf+' · faixa '+BUSCA[i].fx+' · '+BUSCA[i].tot+'/20'});
    }
    if(!out.length){ res.innerHTML='<div style="color:#8A9099">Nada encontrado</div>'; res.classList.add('on'); return; }
    res.innerHTML=out.map(function(o,i){
      return '<div data-i="'+i+'"><span>'+o.nm+'</span><span class="uf-tag">'+o.extra+'</span></div>';
    }).join('');
    res.classList.add('on');
    res.querySelectorAll('div[data-i]').forEach(function(d){
      d.onclick=function(){
        var o=out[+d.dataset.i];
        res.classList.remove('on'); inp.value='';
        if(o.tipo==='uf') entraUF(o.uf);
        else if(S.uf===o.uf) selecionaMun(o.cd);
        else entraUF(o.uf,o.cd);
      };
    });
  });
  document.addEventListener('click',function(e){
    if(!e.target.closest('.busca')) res.classList.remove('on');
  });
}

// ---------- detalhe (município ou UF) ----------
var detTipo='mun', detProps=null, detAba='resumo';

function contagemNacional(){
  var c=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  ufFeats.forEach(function(f){ f.properties.vN.forEach(function(x,i){ c[i]+=x; }); });
  return c;
}
// barra de variável com % E contagem (num de N municípios do escopo)
function barraVar(v, num, escN){
  var pv=escN?Math.round(1000*num/escN)/10:0;
  return '<div class="mvar" data-v="'+v.n+'"><div class="mvar-l"><span class="vnum">'+v.n+
    '</span><span class="mvar-nome">'+v.nome+'</span><span class="mvar-seta">▾</span></div>'+
    '<div class="mvar-barra"><div class="mvar-fill" style="width:'+pv+'%"></div>'+
    '<span class="mvar-pct">'+pv.toLocaleString('pt-BR')+'% · '+nfmt(num)+' de '+nfmt(escN)+
    ' munic.</span></div><div class="mvar-exp">'+(VAREXP[v.n]||'')+'</div></div>';
}
function ligaVars(root){
  (root||document).querySelectorAll('.mvar .mvar-l').forEach(function(el){
    el.onclick=function(){ el.parentElement.classList.toggle('aberta'); };
  });
}

function setAbas(abas, ativa){
  document.querySelector('.det-abas').innerHTML=abas.map(function(a){
    return '<button data-aba="'+a[0]+'"'+(a[0]===ativa?' class="on"':'')+'>'+a[1]+'</button>';
  }).join('');
}

function abreDetalhe(p){                      // MUNICÍPIO
  detTipo='mun'; detProps=p; detAba='resumo';
  document.getElementById('detNome').textContent=p.nm+' — '+p.uf;
  if(p.semICM){
    document.getElementById('detSub').innerHTML='<b style="color:#F4A44C">Sem informação no ICM</b>'+
      ' · município ainda não apurado';
    setAbas([['resumo','Resumo']],'resumo');
  } else {
    document.getElementById('detSub').innerHTML='Faixa <b style="color:'+COR_FX[p.fx]+'">'+p.fx+
      '</b> ('+META.faixas[p.fx]+') · '+p.tot+'/20 pontos · '+p.gLbl;
    setAbas([['resumo','Resumo'],['vars','20 variáveis'],['avancar','Como avançar']],'resumo');
  }
  document.getElementById('detCard').style.display='block';
  renderDetalhe();
}

function abreDetalheUF(p){                     // UNIDADE DA FEDERAÇÃO
  detTipo='uf'; detProps=p; detAba='resumo';
  document.getElementById('detNome').textContent=p.nm+' ('+p.uf+')';
  document.getElementById('detSub').innerHTML='Faixa predominante <b style="color:'+
    COR_FX[p.pred]+'">'+p.pred+'</b> · '+p.media.toLocaleString('pt-BR')+'/20 média · '+
    nfmt(p.n_mun)+' municípios';
  setAbas([['resumo','Resumo territorial'],['vars','20 variáveis (UF)']],'resumo');
  document.getElementById('detCard').style.display='block';
  renderDetalhe();
}

function fechaDetalhe(){ document.getElementById('detCard').style.display='none'; detProps=null;
  atualizaSetasPaineis(); }

function renderDetalhe(){
  if(!detProps) return;
  var p=detProps, c=document.getElementById('detCorpo'), h='';
  if(detTipo==='uf'){ h=(detAba==='vars')?renderUFvars(p):renderUFresumo(p); }
  else if(p.semICM){ h=renderMunSemICM(p); }
  else if(detAba==='resumo'){ h=renderMunResumo(p); }
  else if(detAba==='vars'){ h=renderMunVars(p); }
  else { h=renderMunAvancar(p); }
  c.innerHTML=h;
  if(detAba==='vars') ligaVars(c);
  var pe=document.getElementById('painelEsq'); if(pe) pe.scrollTop=0;
  atualizaSetasPaineis();
}

function renderMunResumo(p){
  return '<table class="tab-l">'+
    lin('Município',p.nm)+lin('UF',p.uf)+lin('Região',p.rg)+
    lin('População',popfmt(p.pop))+lin('Área',nfmt(p.area)+' km²')+
    lin('Faixa ICM','<span class="pill p'+p.fx+'">'+p.fx+'</span> '+META.faixas[p.fx])+
    lin('Pontuação total','<b>'+p.tot+'</b> / 20')+
    lin('Dim. I — '+META.dimensoes.I.nome,p.d1+' / 8')+
    lin('Dim. II — '+META.dimensoes.II.nome,p.d2+' / 7')+
    lin('Dim. III — '+META.dimensoes.III.nome,p.d3+' / 5')+
    lin('Porte',p.porte)+lin('Perfil de risco',p.risco)+
    lin('Grupo de enquadramento',p.gLbl)+lin('Código IBGE',p.cd)+'</table>';
}
function renderMunSemICM(p){
  return '<table class="tab-l">'+lin('Município',p.nm)+lin('UF',p.uf)+lin('Região',p.rg)+
    lin('População',popfmt(p.pop))+lin('Área',nfmt(p.area)+' km²')+
    lin('Código IBGE',p.cd)+'</table>'+
    '<div class="nar-destaque" style="margin-top:10px">Este município <b>não possui apuração '+
    'no ICM</b> (por exemplo, município recém-instalado). Aparece em cinza no mapa. Assim que '+
    'for apurado, passará a exibir faixa, pontuação e as 20 variáveis.</div>';
}
function renderMunVars(p){
  var h='';
  ['I','II','III'].forEach(function(dim){
    var vs=META.variaveis.filter(function(v){ return v.dim===dim; });
    var obt=vs.reduce(function(a,v){ return a+p.vars[v.n-1]; },0);
    h+='<div class="dimbloco"><div class="dimtit"><span style="color:#272F68">Dimensão '+dim+
      ' — '+META.dimensoes[dim].nome+'</span><span>'+obt+'/'+META.dimensoes[dim].n+'</span></div>';
    vs.forEach(function(v){
      var tem=p.vars[v.n-1]===1;
      h+='<div class="vitem"><div class="vnum">'+v.n+'</div><div class="vtxt">'+v.nome+'</div>'+
        '<div class="'+(tem?'vsim':'vnao')+'">'+(tem?'Sim':'Não')+'</div></div>';
    });
    h+='</div>';
  });
  return h+'<div class="dimtit" style="background:#272F68;color:#fff"><span>Total</span>'+
    '<span style="color:#F4A44C">'+p.tot+'/20</span></div>';
}
function renderMunAvancar(p){
  var f=p.falta;
  if(!f) return '<div class="avanc"><div class="alvo"><b>Faixa A — capacidade alta.</b><br>'+
    'Este município já está na faixa máxima do ICM.</div></div>';
  var nomes={I:META.dimensoes.I.nome,II:META.dimensoes.II.nome,III:META.dimensoes.III.nome};
  var h='<div class="avanc"><div class="alvo">Para alcançar a <b>faixa '+f.alvo+' ('+
    META.faixas[f.alvo]+')</b>, como <b>'+p.gLbl.toLowerCase()+'</b>, o município precisa '+
    'atingir os mínimos abaixo <b>em cada dimensão</b>:</div>';
  [['I',p.d1,f.req[0],f.I],['II',p.d2,f.req[1],f.II],['III',p.d3,f.req[2],f.III]].forEach(function(x){
    h+='<div class="barra"><span>Dim. '+x[0]+' — '+nomes[x[0]]+'<br><span style="color:#8A9099;'+
      'font-size:11px">tem '+x[1]+' · exige '+x[2]+'</span></span><span class="'+(x[3]>0?'falta':'ok')+
      '">'+(x[3]>0?'faltam '+x[3]:'✓ atende')+'</span></div>';
  });
  h+='<div class="barra"><span>Total de pontos<br><span style="color:#8A9099;font-size:11px">tem '+
    p.tot+' · exige '+f.req[3]+'</span></span><span class="'+(f.total>0?'falta':'ok')+'">'+
    (f.total>0?'faltam '+f.total:'✓ atende')+'</span></div>'+
    '<div class="dica" style="margin-top:8px">Requisitos da Tabela 4 da Nota Técnica nº 1/2023. '+
    'Veja na aba <b>20 variáveis</b> quais instrumentos ainda faltam.</div></div>';
  return h;
}
function renderUFresumo(p){
  var np=p.n_mun-p.prior;
  return '<table class="tab-l">'+
    lin('Unidade da Federação',p.nm)+lin('Sigla',p.uf)+lin('Região',p.rg)+
    lin('Código IBGE (UF)',ufCod(p.uf))+
    lin('Municípios',nfmt(p.n_mun))+
    lin('População (2025)',popfmt(p.pop))+
    lin('Área total',nfmt(p.area)+' km²')+
    lin('Faixa predominante','<span class="pill p'+p.pred+'">'+p.pred+'</span> '+META.faixas[p.pred])+
    lin('Pontuação média municipal','<b>'+p.media.toLocaleString('pt-BR')+'</b> / 20')+
    lin('Prioritários',nfmt(p.prior)+' ('+pfmt(p.prior,p.n_mun)+')')+
    lin('Não prioritários',nfmt(np)+' ('+pfmt(np,p.n_mun)+')')+
    '</table>'+
    '<div class="dimtit" style="margin-top:8px"><span style="color:#272F68">Distribuição por faixa'+
    '</span></div><table class="tab-l">'+
    ORDEM_FX.map(function(fx){ return '<tr><td><span class="pill p'+fx+'">'+fx+'</span> '+
      META.faixas[fx]+'</td><td><b>'+nfmt(p['f'+fx])+'</b> ('+pfmt(p['f'+fx],p.n_mun)+')</td></tr>';
    }).join('')+'</table>'+
    '<div class="nar-destaque" style="margin-top:9px">Estes valores por UF são <b>leituras '+
    'derivadas</b> deste painel (a metodologia atribui faixa e pontuação apenas a municípios).</div>';
}
function renderUFvars(p){
  var h='<p class="mod-intro" style="margin:0 0 8px">Percentual e contagem de municípios de <b>'+
    p.nm+'</b> que possuem cada instrumento (de '+nfmt(p.n_mun)+' municípios). Clique para a '+
    'explicação. <a href="#" onclick="modalVars();return false" style="color:#3A4585">Comparar com o Brasil ↗</a></p>';
  ['I','II','III'].forEach(function(dim){
    var vs=META.variaveis.filter(function(v){ return v.dim===dim; });
    h+='<div class="dimtit" style="margin-top:8px"><span style="color:#272F68">Dimensão '+dim+
      ' — '+META.dimensoes[dim].nome+'</span></div>';
    vs.forEach(function(v){ h+=barraVar(v, p.vN[v.n-1], p.n_mun); });
  });
  return h;
}
function ufCod(sg){ var m={RO:11,AC:12,AM:13,RR:14,PA:15,AP:16,TO:17,MA:21,PI:22,CE:23,
  RN:24,PB:25,PE:26,AL:27,SE:28,BA:29,MG:31,ES:32,RJ:33,SP:35,PR:41,SC:42,RS:43,
  MS:50,MT:51,GO:52,DF:53}; return m[sg]||'—'; }
function lin(k,v){ return '<tr><td>'+k+'</td><td>'+v+'</td></tr>'; }

// ---------- legenda ----------
function legenda(){
  var el=document.getElementById('legenda'); if(!el) return; var h='';
  function row(c,l){ return '<div class="row"><span class="sw" style="background:'+c+'"></span>'+l+'</div>'; }
  // agregado por estado (só quando o Brasil é mostrado por UF)
  var porUF=(S.nivel==='brasil' && S.brModo==='uf');
  // exibe municípios "sem informação" quando há municípios no mapa (drill de UF ou Brasil por município)
  var temMun=(S.nivel==='uf') || (S.nivel==='brasil' && S.brModo==='mun');
  if(S.metric==='faixa'){
    h='<h4>Faixa do ICM'+(porUF?' (predominante na UF)':'')+'</h4>';
    ORDEM_FX.forEach(function(fx){ h+=row(COR_FX[fx],fx+' — '+META.faixas[fx]); });
  } else if(S.metric==='prior'){
    h='<h4>Perfil de risco</h4>';
    if(porUF){
      h+=row(COR_PRIOR,'≥60% prioritários')+row('#D77E28','35–60%')+row(COR_NPRIOR,'<35%');
    } else { h+=row(COR_PRIOR,'Prioritário')+row(COR_NPRIOR,'Não prioritário'); }
  } else {
    h='<h4>Pontuação ICM'+(porUF?' (média municipal da UF)':'')+'</h4>';
    h+=row(RAMPA[0],'0–4')+row(RAMPA[1],'5–8')+row(RAMPA[2],'9–12')+row(RAMPA[3],'13–16')+row(RAMPA[4],'17–20');
  }
  if(temMun) h+=row(COR_SEMICM,'sem informação no ICM');
  if(S.faixa!=='todas') h+='<div class="dica" style="margin-top:5px">Filtro ativo: faixa <b>'+S.faixa+'</b></div>';
  el.innerHTML=h;
}
function rodape(){
  document.getElementById('rodape').innerHTML=
    '<b>Fonte:</b> '+META.fonte+' · <a href="'+META.url_icm+'" target="_blank" rel="noopener" '+
    'style="color:#3A4585">página oficial do ICM</a>.<br>'+
    '<b>Metodologia:</b> '+META.metodologia+'. O enquadramento em faixa considera o porte e o '+
    'perfil de risco do município e exige mínimos de variáveis em cada dimensão. '+
    'Agregados por UF (faixa predominante e média) são leituras derivadas deste painel.<br>'+
    '<b>Elaboração:</b> Lincoln Duques de Barros. Analista de Infraestrutura. SEDEC/MIDR.';
}

// ---------- modais (20 variáveis / metodologia) ----------
function abreModal(titulo,html){
  document.getElementById('modalTit').textContent=titulo;
  var mc=document.getElementById('modalCorpo');
  mc.innerHTML=html;
  document.getElementById('modalFundo').classList.add('on');
  mc.scrollTop=0;
  atualizaSetaScroll(mc);
}
function fechaModal(){ document.getElementById('modalFundo').classList.remove('on'); }

function modalVars(){
  fechaModal();
  var cn=contagemNacional(), N=META.n_municipios;
  var h='<p class="mod-intro">Estatística do <b>Brasil</b>: das '+nfmt(N)+' municipalidades '+
    'apuradas, quantas possuem cada instrumento. O ICM tem <b>20 variáveis</b> binárias em '+
    '<b>três dimensões</b>. Clique numa variável para a explicação. '+
    '<span style="color:#8A9099">Para a estatística por estado, selecione uma UF e abra '+
    '“20 variáveis (UF)”.</span></p>';
  ['I','II','III'].forEach(function(dim){
    var vs=META.variaveis.filter(function(v){ return v.dim===dim; });
    h+='<div class="dimtit" style="margin-top:10px"><span style="color:#272F68">Dimensão '+dim+
      ' — '+META.dimensoes[dim].nome+'</span><span>'+META.dimensoes[dim].n+' variáveis</span></div>';
    vs.forEach(function(v){ h+=barraVar(v, cn[v.n-1], N); });
  });
  h+='<p class="mod-rodape">Definições conforme o Anexo da Nota Técnica nº 1/2023 (questões do '+
    'formulário de apuração). Contagens da apuração de 28/04/2026.</p>';
  abreModal('As 20 variáveis do ICM — Brasil',h);
  ligaVars(document.getElementById('modalCorpo'));
}

function modalMet(){
  function linhaReq(rot,req){
    return '<tr><td>'+rot+'</td><td>'+req.A.join(' / ')+'</td><td>'+req.B.join(' / ')+
      '</td><td>'+req.C.join(' / ')+'</td></tr>';
  }
  var R=META.requisitos;
  var h='<p class="mod-intro">O ICM classifica cada município em <b>quatro faixas</b> de '+
    'capacidade de gestão de riscos e desastres, a partir de 20 variáveis em três dimensões. '+
    'O enquadramento <b>não é um corte simples na pontuação</b>: exige um número mínimo de '+
    'variáveis <b>em cada dimensão</b>, diferenciado pelo porte e pelo perfil de risco do '+
    'município.</p>'+
    '<div class="dimtit"><span style="color:#272F68">As quatro faixas</span></div>'+
    '<div class="mod-faixas">'+
    ORDEM_FX.map(function(fx){ return '<div><span class="pill p'+fx+'">'+fx+'</span> '+
      META.faixas[fx]+'</div>'; }).join('')+'</div>'+
    '<div class="dimtit" style="margin-top:10px"><span style="color:#272F68">As três dimensões'+
    '</span></div><div class="mod-dims">'+
    ['I','II','III'].map(function(d){ return '<div><b>Dimensão '+d+'</b> — '+
      META.dimensoes[d].nome+' ('+META.dimensoes[d].n+' variáveis)</div>'; }).join('')+'</div>'+
    '<div class="dimtit" style="margin-top:10px"><span style="color:#272F68">Requisitos mínimos '+
    'por grupo (Dim I / Dim II / Dim III / Total)</span></div>'+
    '<table class="mod-tab"><tr><th>Grupo de município</th><th>Faixa A</th><th>Faixa B</th>'+
    '<th>Faixa C</th></tr>'+
    linhaReq('Prioritários (2.086, definidos pela Casa Civil)',
      {A:R.prioritario.A,B:R.prioritario.B,C:R.prioritario.C})+
    linhaReq('Não prioritários — médio/grande porte (≥100 mil hab.)',
      {A:R.medio_grande.A,B:R.medio_grande.B,C:R.medio_grande.C})+
    linhaReq('Não prioritários — pequeno porte (<100 mil hab.)',
      {A:R.pequeno.A,B:R.pequeno.B,C:R.pequeno.C})+
    '</table>'+
    '<p class="mod-intro" style="margin-top:8px">Quem não atinge os mínimos da faixa C fica na '+
    'faixa D (Inicial). A apuração é anual, com dados declarados pelos municípios em formulário '+
    'da Sedec e fontes complementares (SGB/CPRM, SNIS, S2iD).</p>'+
    '<div class="mod-botoes">'+
    '<a class="mod-btn" href="'+META.url_icm+'" target="_blank" rel="noopener">Página oficial do ICM ↗</a>'+
    '<a class="mod-btn laranja" href="'+META.url_pdf+'" target="_blank" rel="noopener">Baixar as Notas Técnicas (PDF) ↗</a>'+
    '</div>'+
    '<p class="mod-rodape">'+META.metodologia+'.</p>';
  abreModal('Metodologia do ICM — PPA 2024–2027',h);
}

// ---------- binds ----------
function bindUI(){
  document.getElementById('navBrasil').onclick=function(e){ e.preventDefault(); voltaBrasil(); };
  document.getElementById('navVars').onclick=function(e){ e.preventDefault(); modalVars(); };
  document.getElementById('navMet').onclick=function(e){ e.preventDefault(); modalMet(); };
  document.getElementById('modalFechar').onclick=fechaModal;
  document.getElementById('modalFundo').onclick=function(e){
    if(e.target===this) fechaModal(); };
  document.getElementById('segMetric').onclick=function(e){
    var b=e.target.closest('button'); if(!b) return; S.metric=b.dataset.v; atualiza(); };
  document.getElementById('segFaixa').onclick=function(e){
    var b=e.target.closest('button'); if(!b) return; S.faixa=b.dataset.v; atualiza(); };
  // alterna a visualização nacional entre municípios e estados
  document.getElementById('segBrModo').onclick=function(e){
    var b=e.target.closest('button'); if(!b||b.dataset.v===S.brModo) return;
    S.brModo=b.dataset.v; S.sel=null;
    if(S.nivel==='brasil') desenhaBrasil();
    atualiza();
  };
  document.getElementById('btnVoltar').onclick=voltaBrasil;
  document.getElementById('detFechar').onclick=fechaDetalhe;
  document.querySelector('.det-abas').onclick=function(e){
    var b=e.target.closest('button'); if(!b) return;
    detAba=b.dataset.aba;
    document.querySelectorAll('.det-abas button').forEach(function(x){
      x.classList.toggle('on',x===b); });
    renderDetalhe();
  };
  // exportação (caixinha no mapa; abre no hover via CSS, clique é alternativa p/ toque)
  var expCtl=document.querySelector('.exp-ctl');
  document.getElementById('btnExportar').onclick=function(e){
    e.preventDefault(); e.stopPropagation();
    if(expCtl) expCtl.classList.toggle('aberto'); atualizaExport(); };
  document.getElementById('menuExportar').onclick=function(e){
    var b=e.target.closest('button'); if(!b) return; exportar(b.dataset.exp); };
  document.addEventListener('click',function(e){
    if(expCtl && !e.target.closest('.exp-ctl')) expCtl.classList.remove('aberto'); });
  // setas de rolagem: painéis esquerdo/direito, lista e modal
  ['#painelEsq','#painelDir','.lista-wrap','#modalCorpo'].forEach(function(s){
    var el=document.querySelector(s);
    if(el) el.addEventListener('scroll',function(){ atualizaSetaScroll(el); });
  });
  window.addEventListener('resize',function(){ atualizaSetasPaineis();
    var m=document.getElementById('modalCorpo'); if(m&&m.offsetParent) atualizaSetaScroll(m); });
  bindBusca();
}
function atualizaSetasPaineis(){
  ['#painelEsq','#painelDir','.lista-wrap'].forEach(function(s){
    var el=document.querySelector(s); if(el&&el.offsetParent) atualizaSetaScroll(el); });
}
function loading(on){ document.getElementById('load').classList.toggle('on',on); }

// ===================== EXPORTAÇÕES =====================
function recorte(){
  if(S.sel){ var p=munFeats.find(function(f){ return f.properties.cd===S.sel; });
    return {tipo:'mun', nome:limpaNome(p.properties.nm+'_'+p.properties.uf),
      rot:p.properties.nm+' — '+p.properties.uf, feats:[p]}; }
  if(S.nivel==='uf'){ var u=ufFeats.find(function(f){ return f.properties.uf===S.uf; }).properties;
    return {tipo:'uf', nome:limpaNome(u.nm)+'_municipios', rot:u.nm+' (municípios)', feats:munFeats}; }
  return {tipo:'brasil', nome:'Brasil_UFs', rot:'Brasil (27 UFs)', feats:ufFeats};
}
function limpaNome(s){ return norm(s).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
function baixa(nome, conteudo, mime){
  var blob=(conteudo instanceof Blob)?conteudo:new Blob([conteudo],{type:mime});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=nome;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500);
}
function esc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function propsPlanos(p){
  // achata as props (expande vars[] em v1..v20) para CSV/atributos
  var o={};
  Object.keys(p).forEach(function(k){
    if(k==='vars'&&Array.isArray(p.vars)) p.vars.forEach(function(x,i){ o['v'+(i+1)]=x; });
    else if(k==='vN'&&Array.isArray(p.vN)) p.vN.forEach(function(x,i){ o['vN'+(i+1)]=x; });
    else if(k!=='falta'&&typeof p[k]!=='object') o[k]=p[k];
  });
  return o;
}
function expCSV(){
  var r=recorte();
  if(r.tipo==='brasil'){ // tabela municipal nacional completa (arquivo pronto)
    fetch('dados/municipios_icm.csv').then(function(x){ return x.blob(); })
      .then(function(b){ baixa('ICM_municipios_Brasil.csv', b, 'text/csv'); });
    return;
  }
  var linhas=r.feats.map(function(f){ return propsPlanos(f.properties); });
  var cols=Object.keys(linhas[0]);
  var csv=cols.join(';')+'\n'+linhas.map(function(o){
    return cols.map(function(c){ var v=o[c]==null?'':String(o[c]);
      return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(';'); }).join('\n');
  baixa('ICM_'+r.nome+'.csv', '﻿'+csv, 'text/csv;charset=utf-8');
}
function fcRecorte(){
  var r=recorte();
  return {tipo:'FeatureCollection', name:'ICM_'+r.nome,
    crs:{type:'name',properties:{name:'urn:ogc:def:crs:OGC:1.3:CRS84'}},
    features:r.feats.map(function(f){
      return {type:'Feature', properties:propsPlanos(f.properties), geometry:f.geometry}; })};
}
function expGeoJSON(){
  var r=recorte();
  baixa('ICM_'+r.nome+'.geojson', JSON.stringify(fcRecorte()), 'application/geo+json');
}
function geomKML(g){
  function ring(c){ return '<coordinates>'+c.map(function(p){ return p[0]+','+p[1]; }).join(' ')+'</coordinates>'; }
  function poly(coords){ var h='<Polygon><outerBoundaryIs><LinearRing>'+ring(coords[0])+
    '</LinearRing></outerBoundaryIs>';
    for(var i=1;i<coords.length;i++) h+='<innerBoundaryIs><LinearRing>'+ring(coords[i])+'</LinearRing></innerBoundaryIs>';
    return h+'</Polygon>'; }
  if(g.type==='Polygon') return poly(g.coordinates);
  if(g.type==='MultiPolygon') return '<MultiGeometry>'+g.coordinates.map(poly).join('')+'</MultiGeometry>';
  return '';
}
// cor KML aabbggrr a partir de #rrggbb
function kmlCor(hex, alpha){
  var h=hex.replace('#',''); alpha=alpha||'ff';
  return alpha+h.substr(4,2)+h.substr(2,2)+h.substr(0,2);
}
function estilosKML(){
  var s='';
  ['A','B','C','D'].forEach(function(fx){
    s+='<Style id="fx'+fx+'"><LineStyle><color>'+kmlCor(COR_FX[fx])+'</color><width>1.4</width>'+
      '</LineStyle><PolyStyle><fill>0</fill><outline>1</outline></PolyStyle>'+
      '<BalloonStyle><text>$[description]</text></BalloonStyle></Style>';
  });
  s+='<Style id="fxSem"><LineStyle><color>'+kmlCor(COR_SEMICM)+'</color><width>1.2</width></LineStyle>'+
    '<PolyStyle><fill>0</fill><outline>1</outline></PolyStyle>'+
    '<BalloonStyle><text>$[description]</text></BalloonStyle></Style>';
  return s;
}
function baloICM(p, ehUF){
  var css='style="font-family:Arial,sans-serif;font-size:12px;color:#22252E"';
  var h='<div '+css+'><div style="background:#272F68;color:#fff;padding:6px 9px;border-radius:6px;'+
    'font-weight:bold;font-size:13px">Indicador de Capacidade Municipal — ICM</div>'+
    '<table style="border-collapse:collapse;margin-top:6px;font-size:12px">';
  function lin(k,v){ return '<tr><td style="color:#5B6068;padding:2px 10px 2px 0">'+k+
    '</td><td style="font-weight:bold">'+v+'</td></tr>'; }
  if(ehUF){
    h+=lin(ehUF==='sem'?'Local':'Unidade da Federação', p.nm+(p.uf?' ('+p.uf+')':''));
    if(p.pred){ h+=lin('Faixa predominante', p.pred+' — '+META.faixas[p.pred])+
      lin('Pontuação média municipal', (p.media||0).toLocaleString('pt-BR')+' / 20')+
      lin('Municípios', nfmt(p.n_mun))+
      lin('Prioritários', nfmt(p.prior)+' ('+pfmt(p.prior,p.n_mun)+')'); }
  } else if(p.semICM){
    h+=lin('Município', p.nm+' — '+p.uf)+lin('Região', p.rg)+
      lin('População', popfmt(p.pop))+lin('Área', nfmt(p.area)+' km²')+
      lin('Código IBGE', p.cd)+lin('Situação','Sem informação no ICM');
  } else {
    // conteúdo idêntico ao da aba "Resumo" da ficha do município no painel web
    h+=lin('Município', p.nm)+lin('UF', p.uf)+lin('Região', p.rg)+
      lin('População', popfmt(p.pop))+lin('Área', nfmt(p.area)+' km²')+
      lin('Faixa ICM', p.fx+' — '+META.faixas[p.fx])+
      lin('Pontuação total', p.tot+' / 20')+
      lin('Dim. I — '+META.dimensoes.I.nome, p.d1+' / 8')+
      lin('Dim. II — '+META.dimensoes.II.nome, p.d2+' / 7')+
      lin('Dim. III — '+META.dimensoes.III.nome, p.d3+' / 5')+
      lin('Porte', p.porte)+lin('Perfil de risco', p.risco)+
      lin('Grupo de enquadramento', p.gLbl)+lin('Código IBGE', p.cd);
  }
  return h+'</table><div style="color:#8A9099;font-size:10px;margin-top:6px">'+
    'Fonte: ICM/MIDR · apuração 28/04/2026</div></div>';
}
function expKMZ(){
  var r=recorte();
  var kml='<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">'+
    '<Document><name>ICM — '+esc(r.rot)+'</name>'+estilosKML();
  r.feats.forEach(function(f){ var p=f.properties;
    var uf = r.tipo==='brasil';       // feição UF
    var fx = uf ? p.pred : (p.semICM?'Sem':p.fx);
    var nome = uf ? (p.nm+' ('+p.uf+')') : (p.nm+' — '+p.uf);
    var desc = uf ? baloICM(p,'uf') : (p.semICM?baloICM(p,'sem'):baloICM(p,false));
    kml+='<Placemark><name>'+esc(nome)+'</name><styleUrl>#fx'+fx+'</styleUrl>'+
      '<description><![CDATA['+desc+']]></description>'+geomKML(f.geometry)+'</Placemark>';
  });
  kml+='</Document></kml>';
  var zipped=fflate.zipSync({'doc.kml':fflate.strToU8(kml)},{level:9});
  baixa('ICM_'+r.nome+'.kmz', new Blob([zipped],{type:'application/vnd.google-earth.kmz'}));
}

// ---- gráfico em PNG de alta resolução (instância ECharts fora da tela) ----
function chartPNG(option, w, h){
  var d=document.createElement('div');
  d.style.cssText='position:absolute;left:-9999px;top:0;width:'+w+'px;height:'+h+'px';
  document.body.appendChild(d);
  var c=echarts.init(d,null,{devicePixelRatio:2});
  c.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Arial'}},option));
  var url=c.getDataURL({pixelRatio:2,backgroundColor:'#fff'});
  c.dispose(); d.remove(); return url;
}
// ---- mapa localizador (vetorial, sem satélite → sem taint de canvas) ----
function eachCoord(g,cb){ (function w(a){ if(typeof a[0]==='number') cb(a[0],a[1]); else a.forEach(w); })(g.coordinates); }
function bboxFeats(fs){ var b=[999,999,-999,-999];
  fs.forEach(function(f){ eachCoord(f.geometry,function(x,y){
    if(x<b[0])b[0]=x; if(y<b[1])b[1]=y; if(x>b[2])b[2]=x; if(y>b[3])b[3]=y; }); }); return b; }
// ---- enquadramento CONTINENTAL (ignora ilhas oceânicas a leste, sem alterar o dado) ----
// Trindade/Martim Vaz (ES, ~-29°) e demais ilhas oceânicas ficam a leste de LON_OCEANICA.
// Só afeta zoom/bbox; os polígonos das ilhas continuam no GeoJSON.
var LON_OCEANICA=-34;
function bboxCont(fs){ var b=[999,999,-999,-999];
  fs.forEach(function(f){ eachCoord(f.geometry,function(x,y){
    if(x>LON_OCEANICA) return;                         // descarta ilha oceânica
    if(x<b[0])b[0]=x; if(y<b[1])b[1]=y; if(x>b[2])b[2]=x; if(y>b[3])b[3]=y; }); }); return b; }
function temCont(feat){ var achou=false;
  eachCoord(feat.geometry,function(x){ if(x<=LON_OCEANICA) achou=true; }); return achou; }
// L.latLngBounds só da porção continental (null se a feição for inteiramente oceânica)
function boundsLLcont(fs){ var b=bboxCont(fs);
  if(b[0]>b[2]) return null; return L.latLngBounds([[b[1],b[0]],[b[3],b[2]]]); }
function localizadorPNG(){
  var r=recorte(), W=540,H=540, cv=document.createElement('canvas');
  cv.width=W*2; cv.height=H*2; var ctx=cv.getContext('2d'); ctx.scale(2,2);
  ctx.fillStyle='#DCE6F1'; ctx.fillRect(0,0,W,H);
  var fundo, destaque=null, bb, brMun=false;
  if(r.tipo==='mun'){ fundo=munFeats; destaque=S.sel;
    // Vitória-ES: enquadra a UF sem as ilhas oceânicas (só se o município tiver porção continental)
    var selF=munFeats.find(function(f){ return f.properties.cd===S.sel; });
    bb=(selF&&temCont(selF))?bboxCont(munFeats):bboxFeats(munFeats); }
  else if(r.tipo==='uf'){ fundo=ufFeats; destaque=S.uf; bb=bboxCont(ufFeats); }
  else {   // Brasil: mapa de TODOS os municípios, coloridos pela faixa do ICM (como no painel)
    if(munBrFeats&&munBrFeats.length){ fundo=munBrFeats; brMun=true; }
    else fundo=ufFeats;   // fallback: arquivo nacional ainda não carregado → UFs por predominante
    bb=bboxCont(ufFeats);   // moldura continental (exclui ilhas oceânicas)
  }
  var pad=16, dLon=bb[2]-bb[0], dLat=bb[3]-bb[1];
  var s=Math.min((W-2*pad)/dLon,(H-2*pad)/dLat);
  var ox=pad+((W-2*pad)-dLon*s)/2, oy=pad+((H-2*pad)-dLat*s)/2;
  function P(x,y){ return [ox+(x-bb[0])*s, H-(oy+(y-bb[1])*s)]; }
  function path(g){ ctx.beginPath();
    (function dr(a){ if(typeof a[0][0]==='number'){   // a = anel [[x,y],...]
        a.forEach(function(pt,i){ var q=P(pt[0],pt[1]);
          i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); }); ctx.closePath();
      } else a.forEach(dr); })(g.coordinates); }
  var destFeat=null;
  fundo.forEach(function(f){ var p=f.properties, ehDest=false;
    if(r.tipo==='mun') ehDest=(p.cd===destaque);
    else if(r.tipo==='uf') ehDest=(p.uf===destaque);
    if(ehDest) destFeat=f;                 // o contorno do destaque é desenhado por último (por cima)
    path(f.geometry);
    if(brMun){   // choropleth municipal nacional — sem linhas de divisa (cores em destaque)
      ctx.fillStyle=p.semICM?COR_SEMICM:(COR_FX[p.fx]||COR_SEM);
      ctx.globalAlpha=1; ctx.fill();
      // fio finíssimo da mesma cor só p/ fechar micro-frestas do anti-aliasing
      ctx.lineWidth=.2; ctx.strokeStyle=ctx.fillStyle; ctx.stroke();
      return;
    }
    if(r.tipo==='brasil'){ ctx.fillStyle=COR_FX[p.pred]||'#ccc'; ctx.globalAlpha=.85; }
    else if(ehDest){ ctx.fillStyle=r.tipo==='mun'?COR_FX[p.fx]||'#F4A44C':'#F4A44C'; ctx.globalAlpha=.9; }
    else { ctx.fillStyle='#B9C4D6'; ctx.globalAlpha=.55; }
    ctx.fill(); ctx.globalAlpha=1;
    // linhas brancas finas só para os NÃO destacados; o destaque recebe o contorno depois
    if(!ehDest){ ctx.lineWidth=.5; ctx.strokeStyle='#fff'; ctx.stroke(); }
  });
  // contorno do destaque POR CIMA de todas as linhas brancas (prioridade ao azul-escuro)
  if(destFeat){
    ctx.lineJoin='round'; ctx.lineCap='round';
    path(destFeat.geometry);
    ctx.lineWidth=3.2; ctx.strokeStyle='#fff'; ctx.globalAlpha=.9; ctx.stroke();   // halo p/ separar dos vizinhos
    path(destFeat.geometry);
    ctx.lineWidth=2; ctx.strokeStyle=NAVY; ctx.globalAlpha=1; ctx.stroke();        // contorno azul-escuro nítido
  }
  return cv.toDataURL('image/png');
}

function expPDF(){
  var r=recorte(), res=resumo();
  var loc=localizadorPNG();
  // ---- cabeçalho de informações do ente/recorte ----
  var info='', tituloRel='';
  if(r.tipo==='mun'){ var p=detPropSel();
    tituloRel='Município de '+p.nm+' — '+p.uf;
    info=[['Município',p.nm],['UF / Região',p.uf+' · '+p.rg],['Código IBGE',p.cd],
      ['População (2025)',popfmt(p.pop)],['Área',nfmt(p.area)+' km²'],
      ['Porte / risco',p.porte+' · '+p.risco]];
  } else if(r.tipo==='uf'){ var u=ufFeats.find(function(f){return f.properties.uf===S.uf;}).properties;
    tituloRel='Unidade da Federação — '+u.nm+' ('+u.uf+')';
    info=[['UF',u.nm],['Região',u.rg],['Código IBGE',ufCod(u.uf)],
      ['Municípios',nfmt(u.n_mun)],['População (2025)',popfmt(u.pop)],['Área total',nfmt(u.area)+' km²']];
  } else { var b=resumoBrasil();
    tituloRel='Brasil — panorama nacional';
    info=[['Abrangência','27 UFs · '+nfmt(b.n)+' municípios'],['Prioritários',nfmt(b.prior)+' ('+pfmt(b.prior,b.n)+')'],
      ['Pontuação média',b.media.toLocaleString('pt-BR')+' / 20'],['Fonte','ICM/MIDR — 28/04/2026']];
  }
  var infoTab='<table class="info">'+info.map(function(x){ return '<tr><td>'+esc(x[0])+
    '</td><td>'+esc(x[1])+'</td></tr>'; }).join('')+'</table>';
  var narr=document.getElementById('narCorpo').innerHTML;

  // ---- corpo analítico (difere por tipo p/ não repetir gráficos) ----
  var corpo=r.tipo==='mun'?corpoPDFmun():corpoPDFagreg(r,res);

  var w=window.open('','_blank');
  if(!w){ alert('Permita pop-ups para gerar o relatório.'); return; }
  w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
    '<title>Relatório ICM — '+esc(tituloRel)+'</title><style>'+
    '@page{size:A4 portrait;margin:14mm}'+
    'body{font-family:Arial,Helvetica,sans-serif;color:#22252E;font-size:12px;line-height:1.5;margin:0}'+
    '.cab{display:flex;gap:12px;align-items:center;background:#272F68;color:#fff;padding:12px 16px;'+
    'border-bottom:4px solid #F4A44C}.cab img{width:52px;background:#fff;border-radius:6px;padding:4px}'+
    '.cab h1{font-size:17px;margin:0;font-weight:700}.cab .s{font-size:11px;color:#C7CCE4;margin-top:2px}'+
    '.wrap{padding:14px 18px}'+
    '.intro{display:flex;gap:14px;margin-bottom:6px}.intro .loc{width:224px;flex:0 0 auto}'+
    '.intro .loc img{width:224px;height:224px;object-fit:cover;border:1px solid #C7CCE4;border-radius:8px}'+
    '.intro .loc .cap{font-size:9.5px;color:#8A9099;text-align:center;margin-top:3px}'+
    '.intro .txt{flex:1 1 auto}'+
    'h2{color:#272F68;font-size:14px;margin:16px 0 6px;border-left:4px solid #F4A44C;padding-left:8px}'+
    '.info{border-collapse:collapse;width:100%;font-size:11.5px}'+
    '.info td{padding:4px 6px;border-bottom:1px solid #E3E6ED}.info td:first-child{color:#5B6068;width:42%}'+
    '.info td:last-child{font-weight:700}'+
    '.dest{background:#EEF1F6;border-left:3px solid #F4A44C;border-radius:0 8px 8px 0;padding:8px 11px;margin:8px 0;font-size:11.5px}'+
    '.rp-tab{border-collapse:collapse;width:100%;font-size:11.5px}'+
    '.rp-tab th{background:#272F68;color:#fff;padding:5px 7px;text-align:left}'+
    '.rp-tab td{padding:5px 7px;border-bottom:1px solid #E3E6ED}.rp-tab .tot td{font-weight:700;background:#F0F0F0}'+
    '.pill{display:inline-block;padding:1px 7px;border-radius:9px;color:#fff;font-weight:700;font-size:11px}'+
    '.graf{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;justify-content:center}.graf img{border:1px solid #E3E6ED;border-radius:8px}'+
    '.g-faixa{display:block;width:64%;margin:6px auto;border:1px solid #E3E6ED;border-radius:8px}'+
    '.g-dim{display:block;width:58%;margin:6px auto;border:1px solid #E3E6ED;border-radius:8px}'+
    '.g-vars{display:block;width:100%;max-width:500px;margin:4px auto;border:1px solid #E3E6ED;border-radius:8px}'+
    '.pg2{break-before:page;page-break-before:always}'+
    '.vlist{columns:2;column-gap:16px;font-size:11px}.vlist .vi{break-inside:avoid;padding:2px 0;display:flex;gap:6px}'+
    '.vi .s{color:#1B7A4B;font-weight:700}.vi .n{color:#B5482F;font-weight:700}'+
    '.dimcx{border:1px solid #E3E6ED;border-radius:9px;padding:8px 11px;margin:9px 0;break-inside:avoid}'+
    '.dimcx .dh{display:flex;justify-content:space-between;align-items:center;font-size:12px;'+
    'font-weight:700;color:#272F68;border-bottom:1px solid #E3E6ED;padding-bottom:5px;margin-bottom:6px}'+
    '.dimcx .dh .sc{color:#5B6068}'+
    '.dimcx .vgrid{columns:2;column-gap:16px;font-size:10.5px}'+
    '.dimcx .vi{break-inside:avoid;padding:2px 0;display:flex;gap:6px;line-height:1.35}'+
    'footer{margin:16px 18px;border-top:1px solid #E3E6ED;padding-top:8px;color:#8A9099;font-size:10px}'+
    '.btn{background:#272F68;color:#fff;border:0;padding:9px 16px;border-radius:8px;cursor:pointer;font-weight:700}'+
    '@media print{.noprint{display:none}}</style></head><body>'+
    '<div class="noprint" style="text-align:right;padding:8px 18px">'+
    '<button class="btn" onclick="window.print()">🖨 Imprimir / Salvar em PDF</button></div>'+
    '<div class="cab"><img src="img/marca_defesa_civil_quadrada.png">'+
    '<div><h1>Relatório do ICM — Indicador de Capacidade Municipal</h1>'+
    '<div class="s">'+esc(tituloRel)+' · apuração 28/04/2026 · PPA 2024–2027</div></div></div>'+
    '<div class="wrap">'+
    '<div class="intro"><div class="loc"><img src="'+loc+'">'+
    '<div class="cap">Localização — '+esc(r.rot)+'</div></div>'+
    '<div class="txt"><h2 style="margin-top:0">Identificação</h2>'+infoTab+
    '<div class="dest">'+narr+'</div></div></div>'+
    corpo+'</div>'+
    '<footer>Fonte: '+esc(META.fonte)+'.<br>Metodologia: '+esc(META.metodologia)+'.<br>'+
    'Gerado em '+new Date().toLocaleString('pt-BR')+'.</footer></body></html>');
  w.document.close();
}
function detPropSel(){ var f=munFeats.find(function(x){return x.properties.cd===S.sel;}); return f&&f.properties; }

// quebra um rótulo em linhas (por palavra), no máximo maxLinhas (excedente com reticências)
function quebraRotulo(s, max, maxLinhas){
  var pal=String(s).split(' '), linhas=[], ln='';
  pal.forEach(function(p){
    if(ln && (ln+' '+p).length>max){ linhas.push(ln); ln=p; }
    else ln=ln?(ln+' '+p):p;
  });
  if(ln) linhas.push(ln);
  if(maxLinhas && linhas.length>maxLinhas){
    linhas=linhas.slice(0,maxLinhas);
    var u=linhas[maxLinhas-1];
    if(u.length>max-1) u=u.slice(0,max-1).replace(/\s\S*$/,'');   // corta no limite da palavra
    linhas[maxLinhas-1]=u+'…';
  }
  return linhas.join('\n');
}
// corpo analítico para Brasil/UF (distribuição de faixas + variáveis)
function corpoPDFagreg(r,res){
  var tabFaixa='<table class="rp-tab"><tr><th>Faixa de ICM</th><th>Municípios</th><th>%</th></tr>'+
    ORDEM_FX.map(function(fx){ return '<tr><td><span class="pill p'+fx+'" style="background:'+COR_FX[fx]+
      '">'+fx+'</span> '+META.faixas[fx]+'</td><td>'+nfmt(res.fx[fx])+'</td><td>'+pfmt(res.fx[fx],res.n)+
      '</td></tr>'; }).join('')+'<tr class="tot"><td>Total</td><td>'+nfmt(res.n)+'</td><td>100%</td></tr></table>';
  // gráfico de faixas (alta resolução, dimensão contida)
  var cats=ORDEM_FX.slice().reverse();
  var gFaixa=chartPNG({grid:{left:4,right:66,top:6,bottom:6,containLabel:true},
    xAxis:{type:'value',show:false},yAxis:{type:'category',data:cats.map(function(f){return f+' — '+META.faixas[f];}),
      axisLabel:{fontSize:12,color:'#333'},axisLine:{show:false},axisTick:{show:false}},
    series:[{type:'bar',data:cats.map(function(fx){return {value:res.fx[fx],itemStyle:{color:COR_FX[fx]}};}),
      barWidth:'58%',label:{show:true,position:'right',fontSize:12,color:'#22252E',fontWeight:'bold',
      formatter:function(o){return nfmt(o.value)+'  ·  '+pfmt(o.value,res.n);}}}]},480,250);
  // adoção das 20 variáveis (contagem por escopo) — % E nº de municípios do recorte
  var counts,N;
  if(r.tipo==='uf'){ var u=ufFeats.find(function(f){return f.properties.uf===S.uf;}).properties;
    counts=u.vN; N=u.n_mun; } else { counts=contagemNacional(); N=META.n_municipios; }
  var cntArr=META.variaveis.map(function(v){return counts[v.n-1];}).reverse();
  var pctArr=META.variaveis.map(function(v){return Math.round(1000*counts[v.n-1]/N)/10;}).reverse();
  // rótulos completos, quebrados em até 3 linhas (excedente com reticências) — sem colisão entre faixas
  var rotArr=META.variaveis.map(function(v){return quebraRotulo(v.n+'. '+v.nome,44,3);}).reverse();
  var gVars=chartPNG({grid:{left:4,right:100,top:8,bottom:8,containLabel:true},
    xAxis:{type:'value',max:100,show:false},
    yAxis:{type:'category',data:rotArr,
      axisLabel:{fontSize:9.5,color:'#333',lineHeight:11,margin:8},
      axisLine:{show:false},axisTick:{show:false}},
    series:[{type:'bar',data:pctArr,
      itemStyle:{color:'#F4A44C'},barWidth:'50%',label:{show:true,position:'right',fontSize:9,color:'#333',
      formatter:function(o){return o.value.toLocaleString('pt-BR')+'% · '+nfmt(cntArr[o.dataIndex])+' munic.';}}}]},560,820);
  return '<h2>Distribuição por faixa de ICM</h2>'+tabFaixa+
    '<div class="graf"><img class="g-faixa" src="'+gFaixa+'"></div>'+
    '<div class="pg2"><h2>Adoção das 20 variáveis'+(r.tipo==='uf'?' (nesta UF)':' (Brasil)')+'</h2>'+
    '<div style="font-size:11px;color:#5B6068;margin-bottom:4px">% e nº de municípios que possuem cada '+
    'instrumento, de <b>'+nfmt(N)+'</b> municípios no recorte.</div>'+
    '<div class="graf"><img class="g-vars" src="'+gVars+'"></div></div>';
}
// corpo analítico para MUNICÍPIO (complementar, sem repetir a UF)
function corpoPDFmun(){
  var p=detPropSel();
  if(p.semICM) return '<h2>Situação no ICM</h2><div class="dest">Município sem apuração no ICM '+
    '(por exemplo, recém-instalado). Ainda não possui faixa nem pontuação.</div>';
  var dims=[['I — '+META.dimensoes.I.nome,p.d1,8],['II — '+META.dimensoes.II.nome,p.d2,7],
    ['III — '+META.dimensoes.III.nome,p.d3,5]];
  // gráfico das 3 dimensões (obtido x máximo) — dimensão contida
  var gDim=chartPNG({grid:{left:4,right:34,top:8,bottom:6,containLabel:true},
    legend:{show:true,bottom:0,textStyle:{fontSize:11}},
    xAxis:{type:'value',axisLabel:{fontSize:11}},
    yAxis:{type:'category',data:dims.map(function(d){return 'Dim. '+d[0].split(' — ')[0];}).reverse(),
      axisLabel:{fontSize:12,color:'#333'}},
    series:[{name:'Obtido',type:'bar',data:dims.map(function(d){return d[1];}).reverse(),
      itemStyle:{color:'#272F68'},barGap:'-100%',barWidth:'55%',
      label:{show:true,position:'right',fontSize:12,fontWeight:'bold',color:'#272F68'}},
      {name:'Máximo',type:'bar',data:dims.map(function(d){return d[2];}).reverse(),
      itemStyle:{color:'#E3E6ED'},barWidth:'55%'}]},460,210);
  // 20 variáveis Sim/Não separadas em caixas por dimensão (contextualiza o "como avançar")
  var caixas='';
  ['I','II','III'].forEach(function(dim){
    var vs=META.variaveis.filter(function(v){ return v.dim===dim; });
    var obt=vs.reduce(function(a,v){ return a+p.vars[v.n-1]; },0);
    caixas+='<div class="dimcx"><div class="dh"><span>Dimensão '+dim+' — '+esc(META.dimensoes[dim].nome)+
      '</span><span class="sc">'+obt+'/'+META.dimensoes[dim].n+'</span></div><div class="vgrid">'+
      vs.map(function(v){ var tem=p.vars[v.n-1]===1;
        return '<div class="vi"><span class="'+(tem?'s':'n')+'">'+(tem?'✓':'✗')+'</span>'+
          '<span>'+v.n+'. '+esc(v.nome)+'</span></div>'; }).join('')+'</div></div>';
  });
  // como avançar
  var avc='';
  if(p.falta){ var f=p.falta, faltam=[];
    [['Planejamento',f.I],['Coordenação',f.II],['Políticas',f.III]].forEach(function(x){ if(x[1]>0) faltam.push('<b>'+x[1]+'</b> em '+x[0]); });
    avc='<div class="dest">Para avançar à faixa <b>'+f.alvo+' ('+META.faixas[f.alvo]+')</b>: '+
      (faltam.length?'faltam '+faltam.join(', ')+'.':'consolidar os instrumentos mínimos.')+'</div>';
  } else avc='<div class="dest">Município já na faixa <b>A (Alta)</b> — capacidade máxima.</div>';
  return '<h2>Classificação no ICM</h2>'+
    '<table class="info"><tr><td>Faixa</td><td><span class="pill" style="background:'+COR_FX[p.fx]+'">'+p.fx+
    '</span> '+META.faixas[p.fx]+'</td></tr><tr><td>Pontuação total</td><td>'+p.tot+' / 20</td></tr>'+
    '<tr><td>Grupo de enquadramento</td><td>'+esc(p.gLbl)+'</td></tr></table>'+
    '<h2>Pontuação por dimensão</h2><div class="graf"><img class="g-dim" src="'+gDim+'"></div>'+
    '<div class="pg2"><h2>As 20 variáveis do município</h2>'+caixas+
    '<h2>Como avançar</h2>'+avc+'</div>';
}

function exportar(fmt){
  var ec=document.querySelector('.exp-ctl'); if(ec) ec.classList.remove('aberto');
  try{
    if(fmt==='csv') expCSV();
    else if(fmt==='geojson') expGeoJSON();
    else if(fmt==='kmz') expKMZ();
    else if(fmt==='pdf') expPDF();
  }catch(e){ alert('Falha ao exportar: '+e.message); }
}
function atualizaExport(){
  var r=recorte();
  document.getElementById('ddRecorte').textContent=r.rot;
  document.getElementById('ddNota').innerHTML='<b>GPKG e Shapefile:</b> use os arquivos '+
    'GeoJSON/CSV exportados ou o script de ETL (GDAL) do projeto — formatos binários não são '+
    'gerados no navegador.';
}

// ---------- seta de rolagem interativa ----------
function atualizaSetaScroll(el){
  if(!el) return;
  var host=el.parentElement;
  host.classList.add('scroll-host');
  var seta=el._seta;
  if(!seta){
    seta=document.createElement('button');
    seta.className='scroll-seta'; seta.type='button'; seta.innerHTML='▾';
    seta.title='Rolar para baixo';
    seta.onclick=function(){ el.scrollBy({top:Math.round(el.clientHeight*0.8),behavior:'smooth'}); };
    host.appendChild(seta);
    el._seta=seta;
    el.addEventListener('scroll',function(){ posSeta(el,seta); });
  }
  posSeta(el,seta);
}
function posSeta(el,seta){
  var falta=el.scrollHeight-el.scrollTop-el.clientHeight;
  seta.classList.toggle('on', falta>10);
  seta.style.top=(el.offsetTop+el.clientHeight-32)+'px';
  seta.style.left=(el.offsetLeft+el.clientWidth/2-13)+'px';
}
