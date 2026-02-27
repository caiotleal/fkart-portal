import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, Download, Home, Trophy, CheckSquare, Square, Check, X, ChevronLeft, Share2, Trash2, Maximize, Minimize, Camera, FolderOpen } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// --- CONFIGURAÇÕES ---
const API_BASE = "https://script.google.com/macros/s/AKfycbxfLzrZu3oojlPUmYvRvslWHr06oSYArGBoXh51g_qT0TBHOiniRxcxDIih694bj7IU/exec?id=";
const ID_RAIZ_RECENTES = "1ARYct3McqpPvpkwFN8KE6u3y8JK0yYOB"; 
const ID_RAIZ_ANTIGAS = "1Pt-DZHGexJXripVI6QwVKOt5x5BGVItU";  

// --- CORES DA MARCA SM COMPETITION ---
const CORES = {
  fundo: "bg-[#0A122A]",      
  card: "bg-[#111A3A]",       
  destaque: "text-[#E60000]", 
  botaoVermelho: "bg-[#E60000] hover:bg-[#CC0000]",
  bordaVermelha: "border-[#E60000]"
};

const FOTO_PADRAO = [
  {
    url: "https://images.unsplash.com/photo-1547614040-39fb6783d8e5?q=80&w=2000&auto=format&fit=crop",
    label: "SM Competition / Destaques / Capa.jpg"
  }
];

export default function App() {
  const [rootFolders, setRootFolders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('folders'); 
  const [path, setPath] = useState([]); 
  
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState(null);
  
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  
  const [cachedShareBlob, setCachedShareBlob] = useState(null);
  
  const [heroBackgrounds, setHeroBackgrounds] = useState(FOTO_PADRAO);
  const [currentHeroBg, setCurrentHeroBg] = useState(0);

  const touchStart = useRef(null);
  const touchEnd = useRef(null);

  // Roda o carrossel da tela inicial
  useEffect(() => {
    if (path.length > 0 || heroBackgrounds.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentHeroBg((prev) => (prev + 1) % heroBackgrounds.length);
    }, 4500); 
    return () => clearInterval(interval);
  }, [path, heroBackgrounds]);

  // --- BUSCA AGREGADA ---
  const fetchDynamicHero = async (folderId, currentPath, depth = 0) => {
    if (depth > 3) return []; 
    try {
        const res = await fetch(API_BASE + folderId, { method: "GET", redirect: "follow" }).then(r => r.json());
        const arquivos = res.files || [];
        
        const fotos = arquivos.filter(f => f.mimeType.includes('image/'));
        let fotosAgregadas = [];

        if (fotos.length > 0) {
            fotosAgregadas = fotos.map(f => ({
                url: f.thumbnailLink.replace('=w800', '=w2000'),
                label: `${currentPath} / ${f.name}` 
            }));
        }
        
        const subFolders = arquivos.filter(f => f.mimeType === "application/vnd.google-apps.folder");
            
        if (subFolders.length > 0) {
            const promessas = subFolders.map(sub => fetchDynamicHero(sub.id, `${currentPath} / ${sub.name}`, depth + 1));
            const resultados = await Promise.all(promessas);
            resultados.forEach(resArray => {
                fotosAgregadas = [...fotosAgregadas, ...resArray];
            });
        }
        
        return fotosAgregadas;
    } catch (e) {
        return [];
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);
      try {
        const [resRecentes, resAntigas] = await Promise.all([
          fetch(API_BASE + ID_RAIZ_RECENTES, { method: "GET", redirect: "follow" }).then(r => r.json()),
          fetch(API_BASE + ID_RAIZ_ANTIGAS, { method: "GET", redirect: "follow" }).then(r => r.json())
        ]);

        const anoAtual = new Date().getFullYear().toString();
        const todasAsPastas = [
          ...(resRecentes.files || []).filter(f => f.mimeType === "application/vnd.google-apps.folder"),
          ...(resAntigas.files || []).filter(f => f.mimeType === "application/vnd.google-apps.folder")
        ];

        const sortNatural = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
        const pastaDoAno = todasAsPastas.find(f => f.name.includes(anoAtual));
        const pastasAnteriores = todasAsPastas.filter(f => !f.name.includes(anoAtual)).sort((a,b) => b.name.localeCompare(a.name, undefined, { numeric: true }));

        let conteudoTemporadaAtual = [];

        if (pastaDoAno) {
            const resAnoAtual = await fetch(API_BASE + pastaDoAno.id, { method: "GET", redirect: "follow" }).then(r => r.json());
            const subPastas = (resAnoAtual.files || []).filter(f => f.mimeType === "application/vnd.google-apps.folder").sort(sortNatural);
            const fotosSoltas = (resAnoAtual.files || []).filter(f => f.mimeType.includes('image/')).sort(sortNatural);

            conteudoTemporadaAtual = subPastas.length > 0 ? subPastas : fotosSoltas;

            const rootPathName = pastaDoAno.name;

            if (subPastas.length > 0) {
                const ultimaSub = subPastas[subPastas.length - 1];
                const todasAsFotos = await fetchDynamicHero(ultimaSub.id, `${rootPathName} / ${ultimaSub.name}`);
                
                if (todasAsFotos.length > 0) {
                    const embaralhadas = todasAsFotos.sort(() => 0.5 - Math.random());
                    setHeroBackgrounds(embaralhadas.slice(0, 15));
                }
            } else if (fotosSoltas.length > 0) {
                const fotosMapeadas = fotosSoltas.map(f => ({
                    url: f.thumbnailLink.replace('=w800', '=w2000'),
                    label: `${rootPathName} / Geral / ${f.name}`
                }));
                const embaralhadas = fotosMapeadas.sort(() => 0.5 - Math.random());
                setHeroBackgrounds(embaralhadas.slice(0, 15));
            }
        }

        const structured = [
          { id: 'CAT_ATUAL', name: "Temporada Atual", subItems: conteudoTemporadaAtual, isCategory: true },
          { id: 'CAT_ANTERIOR', name: "Temporadas Anteriores", subItems: pastasAnteriores, isCategory: true }
        ];

        setRootFolders(structured);
        setItems(structured);
      } catch (error) {
        console.error("Falha na inicialização:", error);
      } finally {
        setLoading(false);
      }
    };
    initializeApp();
  }, []);

  const fetchData = async (folderId, folderName, isCategory = false, subItems = []) => {
    if (isCategory) {
      setItems(subItems);
      setViewMode('folders');
      setPath([{ id: folderId, name: folderName, items: subItems, mode: 'folders' }]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_BASE + folderId, { method: "GET", redirect: "follow" });
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
      alert("A pasta solicitada está a sincronizar ou vazia. Por favor, tente novamente num instante.");
    } finally {
      setLoading(false);
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
      const downloadUrl = API_BASE.replace('?id=', '?downloadId=') + photo.id;
      const res = await fetch(downloadUrl, { method: "GET", redirect: "follow" });
      const data = await res.json();
      const blob = base64ToBlob(data.base64, data.mimeType);
      saveAs(blob, data.fileName);
      return { blob, data }; 
    } catch (e) {
        alert("Erro no download da imagem. Tente novamente.");
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
          await new Promise(r => setTimeout(r, 300)); 
        }
      } else {
        const zip = new JSZip();
        const promises = selectedPhotos.map(async (photo) => {
          const downloadUrl = API_BASE.replace('?id=', '?downloadId=') + photo.id;
          const res = await fetch(downloadUrl, { method: "GET", redirect: "follow" });
          const data = await res.json();
          zip.file(data.fileName, data.base64, { base64: true });
        });
        await Promise.all(promises);
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "SM_Kart_Galeria.zip");
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
    const caption = "📸 @clicadosnokart\n🏁 @sm.competition";
    
    try {
      if (!navigator.share) throw new Error("Partilha não suportada.");
      let blob = cachedShareBlob;
      
      if (!blob) {
        const downloadUrl = API_BASE.replace('?id=', '?downloadId=') + photo.id;
        const res = await fetch(downloadUrl);
        const data = await res.json();
        blob = base64ToBlob(data.base64, data.mimeType || "image/jpeg");
        setCachedShareBlob(blob); 
      }

      const file = new File([blob], "sm_kart_foto.jpg", { type: "image/jpeg" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ text: caption, files: [file] });
      } else {
        throw new Error("Formato bloqueado.");
      }
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.message.includes('user gesture')) {
        alert("A foto foi processada em alta qualidade! 🚀\n\nPor favor, clique em 'Partilhar' mais uma vez para abrir o menu.");
      } else if (error.name !== 'AbortError') {
        await navigator.clipboard.writeText(caption).catch(()=>{});
        alert("O seu navegador não suporta a partilha direta. O texto foi copiado.");
        downloadSinglePhoto(photo, true);
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
    const minSwipeDistance = 50;
    const currentIndex = items.findIndex(p => p.id === previewPhoto.id);

    if (distance > minSwipeDistance && currentIndex < items.length - 1) changePhoto(items[currentIndex + 1]);
    if (distance < -minSwipeDistance && currentIndex > 0) changePhoto(items[currentIndex - 1]);
  };

  const currentPreviewIndex = previewPhoto ? items.findIndex(p => p.id === previewPhoto.id) : -1;

  return (
    <div className={`min-h-screen ${CORES.fundo} text-white font-sans pb-24 selection:bg-[#E60000]`}>
      
      <header className={`sticky top-0 z-40 bg-[#0A122A]/90 backdrop-blur-md border-b border-[#E60000]/30 p-4 flex justify-center md:justify-start items-center shadow-[0_4px_30px_rgba(230,0,0,0.15)]`}>
        <img src="/SM.png" alt="SM" className="h-10 cursor-pointer hover:opacity-80 transition-opacity drop-shadow-[0_0_10px_rgba(230,0,0,0.4)]" onClick={handleGoHome} />
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 relative z-10">
        
        {/* === HEADER CINEMATOGRÁFICO E QUADRO DA TELA INICIAL === */}
        {path.length === 0 && !loading && heroBackgrounds.length > 0 && (
          <div className="mb-10">
             
             {/* TÍTULOS DE DESTAQUE COM EFEITOS ESPECIAIS */}
             <div className="flex flex-col items-center justify-center mb-6 mt-2 md:mt-4 animate-in zoom-in duration-1000">
                 <h1 className="text-3xl md:text-5xl lg:text-6xl font-black uppercase tracking-widest italic text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-300 to-gray-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] text-center">
                   Galeria Oficial
                 </h1>
                 <p className={`mt-2 ${CORES.destaque} font-black tracking-[0.2em] uppercase text-[10px] md:text-sm drop-shadow-[0_0_8px_rgba(230,0,0,0.6)] text-center`}>
                   Powered by Clicados no Kart
                 </p>
             </div>
             
             {/* O QUADRO DAS ÚLTIMAS FOTOS */}
             <div className={`relative w-full aspect-[16/9] md:aspect-[21/9] shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-2xl md:rounded-3xl overflow-hidden border-2 ${CORES.bordaVermelha} bg-[#050914]`}>
               
               {heroBackgrounds.map((bg, index) => (
                 <div 
                   key={index}
                   className={`absolute inset-0 bg-cover bg-center transition-all duration-[1500ms] ease-in-out ${currentHeroBg === index ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
                   style={{ backgroundImage: `url(${bg.url})` }}
                 />
               ))}
               
               {/* Degradê na base para garantir a leitura dos selos */}
               <div className="absolute inset-x-0 bottom-0 h-32 md:h-40 bg-gradient-to-t from-[#0A122A]/90 via-[#0A122A]/40 to-transparent pointer-events-none z-20"></div>
               
               {/* SELOS NA BASE (AJUSTADOS PARA NÃO CORTAR NO MOBILE) */}
               <div className="absolute bottom-3 left-3 right-3 md:bottom-5 md:left-5 md:right-5 z-30 flex items-end gap-2 md:gap-3">
                 
                 {/* Selo Últimas Fotos */}
                 <span className={`${CORES.botaoVermelho} text-white text-[9px] md:text-xs font-bold px-2.5 py-1.5 md:px-4 md:py-2 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg shrink-0`}>
                   <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white animate-pulse"></div>
                   Novas Fotos
                 </span>

                 {/* Caminho - Reduzido, sem truncar e quebrando linha naturalmente */}
                 <div className="bg-black/60 backdrop-blur-md px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl border border-white/10 text-[8px] sm:text-[9px] md:text-xs text-white/90 font-medium shadow-lg flex items-start gap-1.5 max-w-[65%] md:max-w-[75%] transition-all">
                    <FolderOpen size={10} className={`${CORES.destaque} shrink-0 mt-0.5 md:mt-0 md:w-[14px] md:h-[14px]`} />
                    <span className="leading-tight break-words whitespace-normal text-left">{heroBackgrounds[currentHeroBg]?.label}</span>
                 </div>
               </div>

             </div>
          </div>
        )}

        {/* BREADCRUMBS DA NAVEGAÇÃO DE PASTAS */}
        {path.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6 text-sm md:text-base text-gray-400 font-medium">
            <button onClick={handleGoHome} className={`hover:${CORES.destaque} flex items-center gap-1 transition-colors`}><Home size={18} /> Início</button>
            {path.map((step, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={16} className="text-gray-500" />
                <span 
                  onClick={() => handleJumpToPath(i)}
                  className={`cursor-pointer transition-colors ${i === path.length-1 ? "text-white font-bold cursor-default" : `hover:${CORES.destaque} text-gray-300`}`}
                >
                  {step.name}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* LOADING GERAL */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`w-12 h-12 border-4 border-[#111A3A] border-t-[#E60000] rounded-full animate-spin`}></div>
            <p className="mt-6 text-xs tracking-[0.2em] text-gray-400 uppercase font-bold">Acessar Servidor...</p>
          </div>
        ) : (
          <div className={viewMode === 'folders' ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3"}>
            {items.map(item => {
              const isSelected = selectedPhotos.some(p => p.id === item.id);
              
              if (viewMode === 'folders') {
                const isAtual = item.id === 'CAT_ATUAL';
                return (
                  <div key={item.id} onClick={() => fetchData(item.id, item.name, item.isCategory, item.subItems)} 
                       className={`cursor-pointer transition-all duration-300 group rounded-3xl border ${isAtual ? `border-[#E60000]/60 hover:border-[#E60000] col-span-1 md:col-span-2 p-8 md:p-12 bg-gradient-to-br from-[#111A3A] to-[#0A122A] shadow-[0_0_30px_rgba(230,0,0,0.15)]` : `border-white/10 hover:border-[#E60000]/50 p-6 md:p-8 ${CORES.card}`}`}>
                    <FolderOpen className={`${CORES.destaque} mb-4 transition-transform duration-500 group-hover:scale-110 ${isAtual ? 'w-12 h-12 md:w-16 md:h-16 drop-shadow-[0_0_15px_rgba(230,0,0,0.5)]' : 'w-10 h-10'}`} /> 
                    <h3 className={`font-black uppercase italic tracking-wide ${isAtual ? 'text-2xl md:text-4xl text-white' : 'text-xl text-gray-200'}`}>{item.name}</h3>
                    <p className="text-gray-400 text-xs md:text-sm mt-3 font-medium flex items-center gap-2">
                      <Camera size={16} className={CORES.destaque} /> Clique para abrir
                    </p>
                  </div>
                );
              }

              return (
                <div key={item.id} className={`relative aspect-[4/5] rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 ${isSelected ? `${CORES.bordaVermelha} shadow-[0_0_20px_rgba(230,0,0,0.4)]` : 'border-transparent hover:border-white/30'}`}>
                  <img src={item.thumbnailLink} loading="lazy" className="w-full h-full object-cover" onClick={(e) => { e.stopPropagation(); changePhoto(item); }} />
                  <div onClick={(e) => { e.stopPropagation(); setSelectedPhotos(prev => isSelected ? prev.filter(p => p.id !== item.id) : [...prev, item]) }} 
                       className={`absolute top-2 right-2 p-2 rounded-lg transition-all shadow-md backdrop-blur-sm ${isSelected ? `${CORES.botaoVermelho} text-white` : 'bg-black/60 text-white/80 hover:bg-black/90 border border-white/20'}`}>
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* LIGHTBOX DE ALTA IMERSÃO */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-[#050914] flex flex-col items-center justify-center" 
             onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
           
           <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-[70] bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
             
             <div className="pointer-events-auto bg-black/60 px-4 py-2.5 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl max-w-[75%] md:max-w-[85%] flex items-center overflow-hidden">
                <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-sm font-semibold whitespace-nowrap overflow-x-auto scrollbar-hide">
                  <Home size={14} className={CORES.destaque} />
                  {path.map((step, i) => (
                    <React.Fragment key={i}>
                      <ChevronRight size={14} className="text-gray-500 opacity-70 flex-shrink-0" />
                      <span className="text-gray-300">{step.name}</span>
                    </React.Fragment>
                  ))}
                  <ChevronRight size={14} className="text-gray-500 opacity-70 flex-shrink-0" />
                  <span className="text-white font-bold tracking-wide">{previewPhoto.name}</span>
                </div>
             </div>

             <div className="flex gap-2 pointer-events-auto flex-shrink-0 ml-2">
               <button onClick={toggleFullscreen} className="text-white/80 hover:text-white p-2.5 md:p-3 rounded-full hover:bg-white/10 transition-all hidden md:block bg-black/40 backdrop-blur-md border border-white/5">
                 {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
               </button>
               <button onClick={() => { setPreviewPhoto(null); if(isFullscreen) toggleFullscreen(); }} className={`text-white/80 hover:${CORES.destaque} p-2.5 md:p-3 rounded-full hover:bg-white/10 transition-all bg-black/40 backdrop-blur-md border border-white/5`}>
                 <X size={24} />
               </button>
             </div>
           </div>
           
           <div className="relative flex items-center justify-center w-full flex-grow h-full overflow-hidden">
              <button onClick={() => currentPreviewIndex > 0 && changePhoto(items[currentPreviewIndex - 1])} 
                      className={`absolute left-2 lg:left-8 p-4 text-white/40 hover:text-white hidden md:block z-[60] transition-all hover:bg-white/10 rounded-full ${currentPreviewIndex === 0 && 'opacity-0 pointer-events-none'}`}>
                  <ChevronLeft size={48} />
              </button>
              
              <div className="relative w-full h-full flex items-center justify-center">
                 {isImageLoading && (
                     <div className="absolute inset-0 flex items-center justify-center z-40">
                         <div className={`w-12 h-12 border-4 border-white/10 border-t-[#E60000] rounded-full animate-spin`}></div>
                     </div>
                 )}
                 <img 
                    src={previewPhoto.thumbnailLink.replace('=w800', '=s0')} 
                    className={`max-w-full max-h-full object-contain select-none transition-opacity duration-300 ease-in-out ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => setIsImageLoading(false)} 
                 />
              </div>

              <button onClick={() => currentPreviewIndex < items.length - 1 && changePhoto(items[currentPreviewIndex + 1])} 
                      className={`absolute right-2 lg:right-8 p-4 text-white/40 hover:text-white hidden md:block z-[60] transition-all hover:bg-white/10 rounded-full ${currentPreviewIndex === items.length - 1 && 'opacity-0 pointer-events-none'}`}>
                  <ChevronRight size={48} />
              </button>
           </div>

           <div className="pb-8 pt-6 flex flex-wrap justify-center gap-3 md:gap-4 w-full px-4 bg-gradient-to-t from-[#050914] via-[#050914]/90 to-transparent z-[60]">
              <button onClick={() => { setSelectedPhotos(prev => prev.some(p => p.id === previewPhoto.id) ? prev.filter(p => p.id !== previewPhoto.id) : [...prev, previewPhoto]) }} 
                      className={`px-5 md:px-6 py-3 rounded-full text-sm font-bold border flex items-center gap-2 transition-all shadow-lg ${selectedPhotos.some(p => p.id === previewPhoto.id) ? `${CORES.botaoVermelho} ${CORES.bordaVermelha} text-white` : 'border-white/20 text-gray-200 hover:bg-white/10 hover:text-white backdrop-blur-md bg-[#111A3A]/40'}`}>
                {selectedPhotos.some(p => p.id === previewPhoto.id) ? <Check size={20} /> : <Square size={20} />} 
                <span className="hidden md:inline">{selectedPhotos.some(p => p.id === previewPhoto.id) ? 'Selecionada' : 'Selecionar'}</span>
              </button>
              
              <button onClick={() => downloadSinglePhoto(previewPhoto)} className="px-5 md:px-6 py-3 rounded-full text-sm font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20 flex items-center gap-2 transition-all backdrop-blur-md">
                {downloadingPhotoId === previewPhoto.id ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Download size={20} />} 
                <span className="hidden md:inline">Download</span>
              </button>

              <button onClick={() => handleNativeShare(previewPhoto)} className={`px-5 md:px-6 py-3 rounded-full text-sm font-bold bg-[#111A3A] text-white border border-white/20 hover:border-[#E60000] hover:bg-[#E60000]/20 flex items-center gap-2 transition-all backdrop-blur-md`}>
                {downloadingPhotoId === 'share-' + previewPhoto.id ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Share2 size={20} className={CORES.destaque} />} 
                <span className="hidden md:inline">Partilhar</span>
              </button>
           </div>
        </div>
      )}

      {/* CARRINHO DE DOWNLOAD FLUTUANTE COM ALERTA */}
      {selectedPhotos.length > 0 && !previewPhoto && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-40 animate-in slide-in-from-bottom-4 duration-300">
          
          {selectedPhotos.length > 10 && (
            <div className="bg-[#E60000]/90 text-white text-[11px] md:text-xs px-4 py-1.5 rounded-full backdrop-blur-md shadow-[0_5px_15px_rgba(230,0,0,0.3)] font-bold tracking-wider uppercase">
               Acima de 10 fotos o arquivo será em ZIP
            </div>
          )}

          <div className={`${CORES.card} text-white border border-white/20 pl-6 pr-4 py-3 rounded-full shadow-[0_15px_50px_rgba(0,0,0,0.9)] flex items-center gap-4 backdrop-blur-xl`}>
            <span className="font-bold text-sm tracking-wide">{selectedPhotos.length} {selectedPhotos.length === 1 ? 'Foto' : 'Fotos'}</span>
            
            <button onClick={() => setSelectedPhotos([])} className={`p-2 text-gray-400 hover:${CORES.destaque} transition-colors rounded-full hover:bg-white/10`} title="Limpar Seleção">
              <Trash2 size={20} />
            </button>
            
            <div className="w-px h-6 bg-white/20 mx-1"></div>

            <button onClick={handleBatchDownload} disabled={isProcessing} className={`${CORES.botaoVermelho} text-white px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(230,0,0,0.5)]`}>
              {isProcessing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> A Processar...</> : <><Download size={18} /> Baixar {selectedPhotos.length > 10 ? 'ZIP' : 'Tudo'}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}