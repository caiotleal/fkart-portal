import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, Download, Home, CheckSquare, Square, Check, X, ChevronLeft, Share2, Trash2, Maximize, Minimize, Camera, FolderOpen, Flag, Lock, Unlock, Edit3, AlertCircle, Youtube } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import FkartTv from './FkartTv';

// --- CONFIGURAÇÕES DO SERVIDOR ---
const API_URL = "https://script.google.com/macros/s/AKfycbzJlFnLUj35s3ArXyiODqJofuPKNubEOyn26UqeHehA9Y27myOKYO04Ef8O3Eoo-0J0Qw/exec";
const YOUTUBE_API_URL = "https://script.google.com/macros/s/AKfycbzPoYsll5BZdFDxFw_DRZOyJMykiknCfNx80mUrsnWnqS7c779_OZU55gZwaHbnyVdk3A/exec";
const ID_RAIZ = "19eOUcFrPo3xmPj9UenxEJZ3TXkVlvNEH"; 

const CORES = {
  fundo: "bg-[#0A0A0A]",      
  card: "bg-[#141414]",       
  destaque: "text-[#E5F20D]", 
  destaqueHover: "hover:text-[#E60000]", 
  botaoVermelho: "bg-[#E60000] hover:bg-[#CC0000]",
  bordaVermelha: "border-[#E60000]",
  bordaAmarela: "border-[#E5F20D]"
};

const FOTO_PADRAO = [
  { url: "https://images.unsplash.com/photo-1547614040-39fb6783d8e5?q=80&w=2000&auto=format&fit=crop", label: "FKART / Bem-vindo" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('fotos'); 

  const [rootFolders, setRootFolders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('folders'); 
  const [path, setPath] = useState([]); 
  
  const [showPreloader, setShowPreloader] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState(null);
  
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  
  const [cachedShareBlob, setCachedShareBlob] = useState(null);
  const [heroBackgrounds, setHeroBackgrounds] = useState(FOTO_PADRAO);
  const [currentHeroBg, setCurrentHeroBg] = useState(0);

  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginData, setLoginData] = useState({ user: '', pass: '' });
  
  const [pendingRenames, setPendingRenames] = useState({});
  const [isSavingRenames, setIsSavingRenames] = useState(false);

  const touchStart = useRef(null);
  const touchEnd = useRef(null);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (Object.keys(pendingRenames).length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingRenames]);

  useEffect(() => {
    if (path.length > 0 || heroBackgrounds.length <= 1) return;
    const interval = setInterval(() => setCurrentHeroBg((prev) => (prev + 1) % heroBackgrounds.length), 4500); 
    return () => clearInterval(interval);
  }, [path, heroBackgrounds]);

  const loadRootData = useCallback(async () => {
    const localCache = localStorage.getItem('fkart_menu_cache');
    let isFirstTime = true;

    if (localCache) {
      const parsedCache = JSON.parse(localCache);
      setRootFolders(parsedCache);
      setItems(parsedCache); 
      setLoading(false);     
      setIsFadingOut(true);
      setTimeout(() => setShowPreloader(false), 400); 
      isFirstTime = false;
    } else {
      setLoading(true); 
    }

    try {
      const res = await fetch(`${API_URL}?id=${ID_RAIZ}`, { method: "GET", redirect: "follow" }).then(r => r.json());
      const todasAsPastas = (res.files || []).filter(f => f.mimeType === "application/vnd.google-apps.folder");

      const categoriasRegras = [
        { id: 'endurance', name: 'ENDURANCE', keys: ['endurance'], exclude: ['dia dos pais'] },
        { id: 'copa_kgv', name: 'COPA KGV', keys: ['copa kgv'], exclude: [] },
        { id: 'copa_itu', name: 'COPA ITU', keys: ['copa itu'], exclude: [] },
        { id: 'itu_kids', name: 'ITU KIDS', keys: ['itu kids'], exclude: [] },
        { id: 'endurance_pais', name: 'ENDURANCE DIA DOS PAIS', keys: ['endurance dia dos pais'], exclude: [] },
        { id: 'fkart_old', name: 'Old School / Pilotech', keys: ['old', 'pilotech', 'piloteche'], exclude: [] },
        { id: 'san_marino', name: 'FKART SAN MARINO', keys: ['san marino'], exclude: [] }
      ];

      const anoAtual = new Date().getFullYear().toString();
      const menuFinal = [];
      const pastasAtribuidas = new Set(); 

      categoriasRegras.forEach(cat => {
          const pastasDestaCategoria = todasAsPastas.filter(p => {
              const nameLower = p.name.toLowerCase();
              const hasKey = cat.keys.some(k => nameLower.includes(k));
              const hasExclude = cat.exclude.some(e => nameLower.includes(e));
              if (hasKey && !hasExclude) { pastasAtribuidas.add(p.id); return true; }
              return false;
          });

          if (pastasDestaCategoria.length === 0) return; 

          const atual = [];
          const anterioresPorAno = {};

          pastasDestaCategoria.forEach(p => {
              let anoDaPasta = p.createdTime ? p.createdTime.substring(0, 4) : "Sem Data";
              if (anoDaPasta === anoAtual) atual.push(p);
              else {
                  if (!anterioresPorAno[anoDaPasta]) anterioresPorAno[anoDaPasta] = [];
                  anterioresPorAno[anoDaPasta].push(p);
              }
          });

          const sortNatural = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
          atual.sort(sortNatural);

          const subItemsCategoria = [];
          if (atual.length > 0) subItemsCategoria.push({ id: `${cat.id}_atual`, name: `Temporada Atual (${anoAtual})`, subItems: atual, isCategory: true });

          const anosAnteriores = Object.keys(anterioresPorAno).sort((a,b) => b.localeCompare(a));
          if (anosAnteriores.length > 0) {
              const pastasAnterioresSeparadas = anosAnteriores.map(ano => {
                  const nomeTemporada = ano === "Sem Data" ? "Outras Temporadas" : `Temporada ${ano}`;
                  return { id: `${cat.id}_ant_${ano}`, name: nomeTemporada, subItems: anterioresPorAno[ano].sort(sortNatural), isCategory: true };
              });
              subItemsCategoria.push({ id: `${cat.id}_anteriores`, name: "Temporadas Anteriores", subItems: pastasAnterioresSeparadas.reverse(), isCategory: true });
          }
          menuFinal.push({ id: cat.id, name: cat.name, subItems: subItemsCategoria, isCategory: true });
      });

      const pastasRestantes = todasAsPastas.filter(p => !pastasAtribuidas.has(p.id));
      if (pastasRestantes.length > 0) {
          const atualRestantes = [];
          const anterioresRestantesPorAno = {};

          pastasRestantes.forEach(p => {
              let anoDaPasta = p.createdTime ? p.createdTime.substring(0, 4) : "Sem Data";
              if (anoDaPasta === anoAtual) atualRestantes.push(p);
              else {
                  if (!anterioresRestantesPorAno[anoDaPasta]) anterioresRestantesPorAno[anoDaPasta] = [];
                  anterioresRestantesPorAno[anoDaPasta].push(p);
              }
          });

          const sortNatural = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
          atualRestantes.sort(sortNatural);

          const subItemsOutros = [];
          if (atualRestantes.length > 0) subItemsOutros.push({ id: `outros_atual`, name: `Temporada Atual (${anoAtual})`, subItems: atualRestantes, isCategory: true });

          const anosOutros = Object.keys(anterioresRestantesPorAno).sort((a,b) => b.localeCompare(a));
          if (anosOutros.length > 0) {
              const subPastasOutros = anosOutros.map(ano => {
                  const nomeTemporada = ano === "Sem Data" ? "Outras Temporadas" : `Temporada ${ano}`;
                  return { id: `outros_ant_${ano}`, name: nomeTemporada, subItems: anterioresRestantesPorAno[ano].sort(sortNatural), isCategory: true };
              });
              subItemsOutros.push({ id: `outros_anteriores`, name: "Temporadas Anteriores", subItems: subPastasOutros.reverse(), isCategory: true });
          }
          menuFinal.push({ id: 'outros_eventos', name: 'OUTROS EVENTOS', subItems: subItemsOutros, isCategory: true });
      }

      setRootFolders(menuFinal);
      localStorage.setItem('fkart_menu_cache', JSON.stringify(menuFinal)); 
      
      setPath(currentPath => {
        if (currentPath.length === 0) setItems(menuFinal);
        return currentPath;
      });

    } catch (error) {
      console.error("Falha na varredura de segundo plano:", error);
    } finally {
      if (isFirstTime) {
        setLoading(false);
        setIsFadingOut(true);
        setTimeout(() => setShowPreloader(false), 800);
      }
    }
  }, []); 

  useEffect(() => { loadRootData(); }, [loadRootData]);

  const fetchData = async (folderId, folderName, isCategory = false, subItems = []) => {
    if (isCategory) {
      setItems(subItems);
      setViewMode('folders');
      setPath([...path, { id: folderId, name: folderName, items: subItems, mode: 'folders' }]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?id=${folderId}`, { method: "GET", redirect: "follow" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const sortNatural = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
      const subFolders = (data.files || []).filter(f => f.mimeType === "application/vnd.google-apps.folder").sort(sortNatural);
      const photos = (data.files || []).filter(f => f.mimeType.includes('image/')).sort(sortNatural);

      let newMode = photos.length > 0 ? 'gallery' : 'folders';
      let newItems = photos.length > 0 ? photos : subFolders;

      setPath([...path, { id: folderId, name: folderName, items: newItems, mode: newMode }]);
      setItems(newItems);
      setViewMode(newMode);
    } catch (error) {
      alert("A pasta solicitada está vazia ou carregando.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.user === 'caioleal' && loginData.pass === '123456') {
      setIsAdmin(true);
      setShowLoginModal(false);
      setLoginData({ user: '', pass: '' });
    } else {
      alert("Credenciais incorretas.");
    }
  };

  const handleQueueRename = (folderId, currentName, e) => {
    e.stopPropagation();
    const displayValue = pendingRenames[folderId] || currentName;
    const newName = window.prompt("Digite o novo nome da pasta:", displayValue);
    if (newName === null) return; 
    if (newName.trim() === currentName) {
      const updated = { ...pendingRenames };
      delete updated[folderId];
      setPendingRenames(updated);
    } else if (newName.trim() !== "") {
      setPendingRenames(prev => ({ ...prev, [folderId]: newName.trim() }));
    }
  };

  const handleConfirmAllRenames = async () => {
    setIsSavingRenames(true);
    try {
      for (const [folderId, newName] of Object.entries(pendingRenames)) {
        const renameUrl = `${API_URL}?action=rename_folder&folderId=${folderId}&newName=${encodeURIComponent(newName)}`;
        await fetch(renameUrl, { method: "GET", redirect: "follow" });
      }
      setPendingRenames({});
      localStorage.removeItem('fkart_menu_cache');
      await loadRootData();
    } catch (err) {
      alert("Houve um problema ao salvar algumas pastas no Google Drive.");
    } finally {
      setIsSavingRenames(false);
    }
  };

  const handleGoHome = () => {
    setItems(rootFolders);
    setViewMode('folders');
    setPath([]);
  };

  const handleJumpToPath = (index) => {
    if (index === path.length - 1) return; 
    const newPath = path.slice(0, index + 1);
    const targetStep = newPath[newPath.length - 1];
    setItems(targetStep.items);
    setViewMode(targetStep.mode);
    setPath(newPath);
  };

  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  };

  const downloadSinglePhoto = async (photo, isBatch = false) => {
    if(!isBatch) setDownloadingPhotoId(photo.id);
    try {
      const directUrl = `https://drive.google.com/uc?export=download&id=${photo.id}`;
      const link = document.createElement('a');
      link.href = directUrl;
      link.target = '_blank'; 
      link.download = photo.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
        alert("Erro no download da imagem.");
    } finally {
      if(!isBatch) setDownloadingPhotoId(null);
    }
  };

  const handleBatchDownload = async () => {
    setIsProcessing(true);
    try {
      if (selectedPhotos.length <= 10) {
        for (const photo of selectedPhotos) {
          await downloadSinglePhoto(photo, true);
          await new Promise(r => setTimeout(r, 800)); 
        }
      } else {
        const fileIds = selectedPhotos.map(p => p.id).join(',');
        const res = await fetch(`${API_URL}?action=create_zip&fileIds=${fileIds}`).then(r => r.json());
        if (res.success && res.downloadUrl) {
            window.location.href = res.downloadUrl; 
        } else {
            throw new Error("Falha ao gerar o ZIP.");
        }
      }
    } catch (e) {
      alert("Erro ao processar o download em lote.");
    } finally {
      setIsProcessing(false);
      setSelectedPhotos([]); 
    }
  };

  const handleNativeShare = async (photo) => {
    setDownloadingPhotoId('share-' + photo.id);
    const caption = "📸 @clicadosnokart\n🏁 @fkart"; 
    try {
      if (!navigator.share) throw new Error("Partilha não suportada.");
      let blob = cachedShareBlob;
      if (!blob) {
        const downloadUrl = `${API_URL}?downloadId=${photo.id}`;
        const res = await fetch(downloadUrl);
        const data = await res.json();
        blob = base64ToBlob(data.base64, data.mimeType || "image/jpeg");
        setCachedShareBlob(blob); 
      }
      const file = new File([blob], "fkart_foto.jpg", { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ text: caption, files: [file] });
      } else {
        throw new Error("Formato bloqueado.");
      }
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.message.includes('user gesture')) {
        alert("Pronto para partilhar! Clique no botão novamente.");
      } else if (error.name !== 'AbortError') {
        await navigator.clipboard.writeText(caption).catch(()=>{});
        alert("O seu navegador não suporta a partilha. Texto copiado.");
      }
    } finally {
      setDownloadingPhotoId(null);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const changePhoto = (newPhoto) => {
    setIsImageLoading(true);
    setCachedShareBlob(null);
    setPreviewPhoto(newPhoto);
  };

  const onTouchStart = (e) => { touchEnd.current = null; touchStart.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e) => { touchEnd.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > 50 && currentPreviewIndex < items.length - 1) changePhoto(items[currentPreviewIndex + 1]);
    if (distance < -50 && currentPreviewIndex > 0) changePhoto(items[currentPreviewIndex - 1]);
  };

  const currentPreviewIndex = previewPhoto ? items.findIndex(p => p.id === previewPhoto.id) : -1;
  const totalPending = Object.keys(pendingRenames).length;

  return (
    <div className={`min-h-screen ${CORES.fundo} text-white font-sans pb-24 selection:bg-[#E60000]`}>
      
      {showPreloader && (
        <div className={`fixed inset-0 z-[100] bg-[#0A0A0A] transition-opacity duration-[800ms] ease-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
          <video autoPlay loop muted playsInline className="w-full h-full object-cover">
            <source src="/fkart_inst.mp4" type="video/mp4" />
          </video>
        </div>
      )}

      {showLoginModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#E60000]/50 p-6 md:p-8 rounded-2xl max-w-sm w-full shadow-[0_0_50px_rgba(230,0,0,0.2)]">
             <h2 className="text-xl md:text-2xl font-black text-white mb-6 flex items-center gap-3 italic tracking-wider"><Lock size={24} className="text-[#E60000]"/> ACESSO RESTRITO</h2>
             <form onSubmit={handleLogin}>
                <input type="text" placeholder="Usuário" value={loginData.user} onChange={e => setLoginData({...loginData, user: e.target.value})} className="w-full mb-4 p-4 bg-black border border-white/10 rounded-xl text-white outline-none focus:border-[#E5F20D] transition-colors" />
                <input type="password" placeholder="Senha" value={loginData.pass} onChange={e => setLoginData({...loginData, pass: e.target.value})} className="w-full mb-6 p-4 bg-black border border-white/10 rounded-xl text-white outline-none focus:border-[#E5F20D] transition-colors" />
                <div className="flex gap-3">
                   <button type="button" onClick={() => setShowLoginModal(false)} className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors">Cancelar</button>
                   <button type="submit" className={`flex-1 py-3.5 rounded-xl ${CORES.botaoVermelho} text-white font-bold transition-colors shadow-[0_0_15px_rgba(230,0,0,0.4)]`}>Entrar</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {totalPending > 0 && activeTab === 'fotos' && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[80] animate-in slide-in-from-top-10 duration-300 w-full max-w-[90%] md:max-w-max">
          <div className="bg-[#141414]/95 border border-[#E5F20D] pl-5 pr-3 py-2 rounded-full shadow-[0_15px_50px_rgba(229,242,13,0.15)] flex flex-wrap items-center justify-between gap-4 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[#E5F20D] font-bold text-sm tracking-wide">
              <AlertCircle size={18} /><span>{totalPending} edição(ões) pendente(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPendingRenames({})} className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-xs font-bold rounded-full hover:bg-white/5">Cancelar</button>
              <button onClick={handleConfirmAllRenames} disabled={isSavingRenames} className={`bg-[#E5F20D] text-black px-5 py-2 rounded-full text-xs font-black flex items-center gap-2 transition-all hover:bg-white ${isSavingRenames ? 'opacity-70 cursor-wait' : ''}`}>
                {isSavingRenames ? <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"/> : <Check size={16} />} Salvando...
              </button>
            </div>
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#E60000]/30 shadow-[0_4px_30px_rgba(230,0,0,0.2)]`}>
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-4 md:gap-6 cursor-pointer" onClick={handleGoHome}>
            <img src="/FKART_LOGO.png" alt="FKART" className="h-8 md:h-12 object-contain rounded-md drop-shadow-[0_0_8px_rgba(230,0,0,0.5)]" />
            <div className="w-px h-6 md:h-8 bg-white/20 hidden md:block"></div>
            <img src="/logo_clicados_new_yellon.png" alt="Clicados no Kart" className="h-6 md:h-10 object-contain drop-shadow-[0_0_8px_rgba(229,242,13,0.3)] hidden md:block" />
          </div>
          <button onClick={() => isAdmin ? setIsAdmin(false) : setShowLoginModal(true)} className={`p-2 rounded-full transition-colors ${isAdmin ? 'text-[#E5F20D] bg-white/5' : 'text-white/20 hover:text-white/60'}`}>
            {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
          </button>
        </div>

        <div className="flex justify-center gap-2 pb-3 px-4 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('fotos')} className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-xs md:text-sm tracking-widest uppercase transition-all ${activeTab === 'fotos' ? 'bg-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.4)]' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            <Camera size={16} /> Galeria de Fotos
          </button>
          <button onClick={() => setActiveTab('videos')} className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-xs md:text-sm tracking-widest uppercase transition-all ${activeTab === 'videos' ? 'bg-[#E5F20D] text-black shadow-[0_0_15px_rgba(229,242,13,0.4)]' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            <Youtube size={18} className={activeTab === 'videos' ? 'text-[#E60000]' : ''} /> FKART TV
          </button>
        </div>
      </header>

      {/* RENDERIZAÇÃO DO COMPONENTE TV CONECTADO COM A NOVA API */}
      {activeTab === 'videos' && <FkartTv youtubeApiUrl={YOUTUBE_API_URL} />}

      {activeTab === 'fotos' && (
        <main className="max-w-7xl mx-auto p-4 md:p-6 relative z-10 animate-in fade-in duration-500">
          {path.length === 0 && !loading && heroBackgrounds.length > 0 && (
            <div className="mb-10 mt-4 flex flex-col items-center justify-center">
               <h1 className="text-3xl md:text-5xl lg:text-6xl font-black uppercase tracking-widest italic text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-300 to-gray-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] text-center">
                 GALERIA OFICIAL
               </h1>
               <p className={`mt-3 ${CORES.destaque} font-black tracking-[0.2em] uppercase text-xs md:text-sm drop-shadow-[0_0_8px_rgba(229,242,13,0.4)] text-center`}>
                 Powered by Clicados no Kart
               </p>
            </div>
          )}

          {path.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-8 text-sm md:text-base text-gray-400 font-medium bg-[#141414]/50 p-3 rounded-2xl border border-white/5">
              <button onClick={handleGoHome} className={`hover:${CORES.destaqueHover} flex items-center gap-1 transition-colors`}><Home size={18} /> Início</button>
              {path.map((step, i) => (
                <React.Fragment key={i}>
                  <ChevronRight size={16} className="text-gray-500" />
                  <span onClick={() => handleJumpToPath(i)} className={`cursor-pointer transition-colors ${i === path.length-1 ? `${CORES.destaque} font-bold cursor-default drop-shadow-[0_0_5px_rgba(229,242,13,0.5)]` : `hover:${CORES.destaqueHover} text-gray-300`}`}>
                    {step.name}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className={`w-14 h-14 border-4 border-[#141414] border-t-[#E60000] border-r-[#E5F20D] rounded-full animate-spin`}></div>
              <p className="mt-6 text-xs tracking-[0.2em] text-gray-400 uppercase font-bold">Lendo Servidor...</p>
            </div>
          ) : (
            <div className={viewMode === 'folders' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3"}>
              {items.map(item => {
                const isSelected = selectedPhotos.some(p => p.id === item.id);
                
                if (viewMode === 'folders') {
                  const isMainCategory = path.length === 0;
                  const isPending = pendingRenames[item.id] !== undefined;
                  const displayName = isPending ? pendingRenames[item.id] : item.name;

                  return (
                    <div key={item.id} className={`relative transition-all duration-300 group rounded-2xl border ${isPending ? 'border-[#E5F20D]' : 'border-white/10'} ${CORES.card} hover:bg-[#1A1A1A] hover:border-[#E60000]/60 shadow-lg hover:shadow-[0_0_25px_rgba(230,0,0,0.2)] flex flex-col items-center justify-center text-center overflow-hidden`}>
                      {isAdmin && !item.isCategory && !isMainCategory && (
                        <button onClick={(e) => handleQueueRename(item.id, displayName, e)} className="absolute top-3 right-3 p-2.5 bg-black/80 border border-white/10 hover:bg-[#E5F20D] hover:text-black rounded-full text-white/70 transition-colors z-20 shadow-md" title="Editar Nome (Lote)">
                          <Edit3 size={16} />
                        </button>
                      )}
                      <div onClick={() => fetchData(item.id, item.name, item.isCategory, item.subItems)} className="w-full h-full p-6 md:p-8 flex flex-col items-center justify-center cursor-pointer">
                        {isMainCategory ? (
                          <Flag className={`mb-4 w-12 h-12 ${item.id === 'outros_eventos' ? 'text-gray-500 group-hover:text-gray-300' : 'text-[#E60000] group-hover:text-[#E5F20D]'} transition-transform duration-500 group-hover:scale-110`} />
                        ) : (
                          <FolderOpen className={`mb-4 w-10 h-10 ${isPending ? 'text-[#E5F20D]' : CORES.destaque} transition-transform duration-500 group-hover:scale-110`} /> 
                        )}
                        <h3 className={`font-black uppercase italic tracking-wider text-lg md:text-xl ${isPending ? 'text-[#E5F20D]' : (item.id === 'outros_eventos' ? 'text-gray-300' : 'text-white')} group-hover:text-[#E5F20D] transition-colors px-4`}>{displayName}</h3>
                        {isPending && <span className="text-[10px] text-[#E5F20D] font-bold tracking-widest uppercase mt-1">Não Salvo</span>}
                        {!isMainCategory && !item.isCategory && !isPending && (
                          <p className="text-gray-400 text-xs md:text-sm mt-3 font-medium flex items-center gap-2">
                            <Camera size={16} className="text-[#E60000]" /> Acessar Galeria
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={item.id} className={`relative aspect-[4/5] rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 ${isSelected ? `${CORES.bordaAmarela} shadow-[0_0_20px_rgba(229,242,13,0.3)]` : 'border-transparent hover:border-[#E60000]/50'}`}>
                    <img src={item.thumbnailLink.replace('=w800', '=w400')} loading="lazy" className="w-full h-full object-cover bg-[#1A1A1A] transition-opacity duration-300" onClick={(e) => { e.stopPropagation(); changePhoto(item); }} />
                    <div onClick={(e) => { e.stopPropagation(); setSelectedPhotos(prev => isSelected ? prev.filter(p => p.id !== item.id) : [...prev, item]) }} 
                         className={`absolute top-2 right-2 p-1.5 md:p-2 rounded-lg transition-all shadow-md backdrop-blur-sm ${isSelected ? `bg-[#E5F20D] text-black` : 'bg-black/60 text-white/80 hover:bg-[#E60000] hover:text-white border border-white/20'}`}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {previewPhoto && activeTab === 'fotos' && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col items-center justify-center" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
           <div className="fixed top-0 left-0 w-full p-2 md:p-3 flex justify-between items-start z-[70] bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none">
             <div className="pointer-events-auto bg-black/80 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 shadow-xl max-w-[75%] md:max-w-[85%] flex items-center overflow-hidden">
                <div className="flex items-center gap-1.5 text-[9px] md:text-[11px] font-semibold whitespace-nowrap overflow-x-auto scrollbar-hide">
                  <span className={`${CORES.destaque}`}>{path[path.length-1]?.name || 'Galeria'}</span>
                  <ChevronRight size={12} className="text-gray-500 opacity-70 flex-shrink-0" />
                  <span className="text-white tracking-wide">{previewPhoto.name}</span>
                </div>
             </div>
             <div className="flex gap-1.5 pointer-events-auto flex-shrink-0 ml-2">
               <button onClick={toggleFullscreen} className="text-white/80 hover:text-[#E5F20D] p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 transition-colors hidden md:block">
                 {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
               </button>
               <button onClick={() => { setPreviewPhoto(null); if(isFullscreen) toggleFullscreen(); }} className={`text-white/80 hover:text-[#E60000] p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 transition-colors`}>
                 <X size={16} />
               </button>
             </div>
           </div>
           
           <div className="relative flex items-center justify-center w-full flex-grow h-full overflow-hidden">
              <button onClick={() => currentPreviewIndex > 0 && changePhoto(items[currentPreviewIndex - 1])} className={`absolute left-2 lg:left-6 p-2 text-white/40 hover:text-[#E5F20D] hidden md:block z-[60] transition-colors rounded-full ${currentPreviewIndex === 0 && 'opacity-0 pointer-events-none'}`}>
                  <ChevronLeft size={28} />
              </button>
              <div className="relative w-full h-full flex items-center justify-center">
                 {isImageLoading && <div className="absolute inset-0 flex items-center justify-center z-40"><div className="w-6 h-6 border-2 border-white/10 border-t-[#E60000] rounded-full animate-spin"></div></div>}
                 <img src={previewPhoto.thumbnailLink.replace('=w800', '=w2000')} className={`max-w-full max-h-full object-contain select-none transition-opacity duration-300 ease-in-out ${isImageLoading ? 'opacity-0' : 'opacity-100'}`} onLoad={() => setIsImageLoading(false)} />
              </div>
              <button onClick={() => currentPreviewIndex < items.length - 1 && changePhoto(items[currentPreviewIndex + 1])} className={`absolute right-2 lg:right-6 p-2 text-white/40 hover:text-[#E5F20D] hidden md:block z-[60] transition-colors rounded-full ${currentPreviewIndex === items.length - 1 && 'opacity-0 pointer-events-none'}`}>
                  <ChevronRight size={28} />
              </button>
           </div>

           <div className="fixed bottom-0 left-0 pb-4 pt-6 flex flex-wrap justify-center gap-2 w-full px-2 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/90 to-transparent z-[70]">
              <button onClick={() => setSelectedPhotos(prev => prev.some(p => p.id === previewPhoto.id) ? prev.filter(p => p.id !== previewPhoto.id) : [...prev, previewPhoto])} className={`px-3 py-1.5 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-[11px] font-bold border flex items-center gap-1.5 transition-all shadow-md ${selectedPhotos.some(p => p.id === previewPhoto.id) ? `bg-[#E5F20D] border-[#E5F20D] text-black` : 'border-white/20 text-gray-200 hover:bg-white/10 bg-[#141414]/80'}`}>
                {selectedPhotos.some(p => p.id === previewPhoto.id) ? <Check size={14} /> : <Square size={14} />} 
                <span className="hidden md:inline">{selectedPhotos.some(p => p.id === previewPhoto.id) ? 'Selecionada' : 'Selecionar'}</span>
              </button>
              
              <button onClick={() => downloadSinglePhoto(previewPhoto)} className="px-3 py-1.5 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-[11px] font-bold bg-[#141414]/80 text-white border border-white/20 hover:border-[#E5F20D] hover:text-[#E5F20D] flex items-center gap-1.5 transition-colors">
                {downloadingPhotoId === previewPhoto.id ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin"></div> : <Download size={14} />} 
                <span className="hidden md:inline">Download</span>
              </button>
              
              <button onClick={() => handleNativeShare(previewPhoto)} className={`px-3 py-1.5 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-[11px] font-bold ${CORES.botaoVermelho} text-white border border-[#E60000] flex items-center gap-1.5 transition-colors shadow-[0_0_8px_rgba(230,0,0,0.4)]`}>
                {downloadingPhotoId === 'share-' + previewPhoto.id ? <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin"></div> : <Share2 size={14} />} 
                <span className="hidden md:inline">Partilhar</span>
              </button>
           </div>
        </div>
      )}

      {selectedPhotos.length > 0 && !previewPhoto && activeTab === 'fotos' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[60] animate-in slide-in-from-bottom-4 duration-300">
          <div className={`${CORES.card} text-white border border-white/20 pl-4 pr-3 py-2 rounded-full shadow-[0_15px_50px_rgba(0,0,0,0.9)] flex items-center gap-3 backdrop-blur-xl`}>
            <span className="font-bold text-xs tracking-wide text-[#E5F20D]">{selectedPhotos.length} {selectedPhotos.length === 1 ? 'Foto' : 'Fotos'}</span>
            <button onClick={() => setSelectedPhotos([])} className={`p-1.5 text-gray-400 hover:text-[#E60000] transition-colors rounded-full hover:bg-white/5`} title="Limpar Seleção"><Trash2 size={16} /></button>
            <div className="w-px h-4 bg-white/20 mx-0.5"></div>
            <button onClick={handleBatchDownload} disabled={isProcessing} className={`${CORES.botaoVermelho} text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(230,0,0,0.5)]`}>
              {isProcessing ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"/> Processando...</> : <><Download size={14} /> Baixar Tudo</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}