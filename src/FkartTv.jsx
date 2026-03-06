import React, { useState, useEffect } from 'react';
import { Tv, Play, Radio, Youtube, Share2, Disc, PlayCircle, CalendarClock, ChevronDown, ChevronLeft, Calendar } from 'lucide-react';

export default function FkartTv({ youtubeApiUrl }) {
  const [youtubeData, setYoutubeData] = useState({ live: null, playlists: [] });
  const [loading, setLoading] = useState(true);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [expandedPlaylist, setExpandedPlaylist] = useState(null);
  const [siteOrigin, setSiteOrigin] = useState("");

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    const fetchYouTubeData = async () => {
      if (!youtubeApiUrl) return; 
      setLoading(true);
      try {
        const res = await fetch(youtubeApiUrl, { method: "GET", redirect: "follow" });
        const data = await res.json();
        if (data && data.success && data.data) {
          setYoutubeData({
            live: data.data.live || null,
            playlists: Array.isArray(data.data.playlists) ? data.data.playlists : []
          });
        }
      } catch (error) {
        console.error("Erro na FKART TV:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchYouTubeData();
  }, [youtubeApiUrl]);

  const handleShareVideo = async (video) => {
    const url = `https://youtu.be/${video.id}`; 
    const text = `Assista na FKART TV: ${video.title}\n🏁 @fkart`;
    if (navigator.share) {
      try { await navigator.share({ title: video.title, text: text, url: url }); } catch (e) {}
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      alert("Link copiado!");
    }
  };

  const togglePlaylist = (id) => setExpandedPlaylist(prev => prev === id ? null : id);

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 relative z-10 animate-in fade-in duration-500">
      <div className="mb-10 mt-4 flex flex-col items-center justify-center">
         <h1 className="text-3xl md:text-5xl font-black uppercase tracking-widest italic text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-300 to-gray-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] text-center flex items-center gap-3">
           <Tv className="text-[#E60000] w-10 h-10 md:w-14 md:h-14" /> FKART TV
         </h1>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-14 h-14 border-4 border-[#141414] border-t-[#E60000] border-r-[#E5F20D] rounded-full animate-spin"></div>
          <p className="mt-6 text-xs tracking-[0.2em] text-gray-400 uppercase font-bold">Organizando Acervo...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {youtubeData.live && (
            <div className="bg-gradient-to-r from-[#E60000] to-red-900 text-white p-5 rounded-3xl flex items-center justify-between gap-4 shadow-[0_0_30px_rgba(230,0,0,0.5)] border border-[#E5F20D]/30 cursor-pointer hover:scale-[1.01] transition-transform" onClick={() => setPreviewVideo(youtubeData.live)}>
              <div className="flex items-center gap-3 font-black uppercase tracking-widest text-sm md:text-lg">
                 <Radio size={28} className="animate-pulse text-[#E5F20D]" /> TRANSMISSÃO AGENDADA
              </div>
              <p className="text-sm md:text-xl font-bold line-clamp-1">{youtubeData.live.title}</p>
            </div>
          )}

          <h2 className="text-[#E5F20D] font-black uppercase tracking-widest mb-2 flex items-center gap-2 border-b border-white/10 pb-4">
            <Disc size={20} fill="currentColor" /> Campeonatos & Temporadas
          </h2>

          <div className="flex flex-col gap-4">
            {youtubeData.playlists.map(pl => (
              <div key={pl.id} className="flex flex-col border border-white/10 rounded-2xl bg-[#141414] overflow-hidden transition-all duration-300">
                <button onClick={() => togglePlaylist(pl.id)} className={`w-full flex justify-between items-center p-5 transition-all ${expandedPlaylist === pl.id ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                  <div className="flex items-center gap-4 text-left">
                    <div className={`p-2 rounded-full ${expandedPlaylist === pl.id ? 'bg-[#E60000]' : 'bg-black/50'}`}>
                       <Youtube size={24} className={expandedPlaylist === pl.id ? 'text-white' : 'text-[#E60000]'} />
                    </div>
                    <span className="font-bold text-white text-base md:text-lg uppercase tracking-tight">{pl.title}</span>
                  </div>
                  <ChevronDown size={24} className={`text-gray-400 transition-transform duration-300 ${expandedPlaylist === pl.id ? 'rotate-180 text-[#E5F20D]' : ''}`} />
                </button>

                <div className={`grid transition-all duration-300 ease-in-out ${expandedPlaylist === pl.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden bg-black/20">
                    {pl.secoesPorAno.map((secao, idx) => (
                      <div key={secao.ano} className="p-6 border-t border-white/5 first:border-t-0">
                        {/* DIVISOR DE ANO SUAVE */}
                        <div className="flex items-center gap-4 mb-6">
                           <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                              <Calendar size={14} className="text-[#E5F20D]" />
                              <span className="text-[#E5F20D] font-black text-sm tracking-widest uppercase">{secao.ano}</span>
                           </div>
                           <div className="h-px flex-grow bg-gradient-to-r from-white/10 to-transparent"></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {secao.videos.map(vid => (
                            <div key={vid.id} onClick={() => setPreviewVideo(vid)} className="group cursor-pointer flex flex-col md:flex-row bg-[#0A0A0A] border border-white/5 rounded-xl hover:border-[#E60000]/40 transition-all hover:shadow-[0_0_20px_rgba(230,0,0,0.1)]">
                               <div className="relative w-full md:w-32 aspect-video flex-shrink-0 overflow-hidden rounded-t-xl md:rounded-l-xl md:rounded-tr-none">
                                 <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80 group-hover:opacity-100" />
                                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                   <PlayCircle size={24} className="text-white" />
                                 </div>
                               </div>
                               <div className="p-3 flex items-center">
                                 <h4 className="text-xs text-gray-400 font-bold line-clamp-2 group-hover:text-white transition-colors">{vid.title}</h4>
                               </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewVideo && (
        <div className="fixed inset-0 z-[300] bg-black/98 flex flex-col items-center justify-center p-4 md:p-8 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-5xl flex flex-col gap-4 animate-in zoom-in-95 duration-300">
             <div className="w-full aspect-video bg-[#0A0A0A] rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(230,0,0,0.5)] border border-[#E60000]/40 relative">
               <iframe 
                  width="100%" height="100%" 
                  src={`https://www.youtube.com/embed/${previewVideo.id}?autoplay=1&rel=0&hl=pt-br&gl=BR&origin=${siteOrigin}`} 
                  title="YouTube video player" frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  referrerPolicy="strict-origin-when-cross-origin" allowFullScreen
                  className="absolute inset-0 z-10 bg-black"
               ></iframe>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={() => setPreviewVideo(null)} className="bg-[#E60000] hover:bg-[#CC0000] text-white py-3.5 rounded-xl flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] shadow-[0_0_15px_rgba(230,0,0,0.4)] font-black uppercase tracking-widest text-xs"><ChevronLeft size={18} /> Voltar ao Portal</button>
                <button onClick={() => handleShareVideo(previewVideo)} className="bg-[#141414] hover:bg-white/10 text-white border border-white/20 py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-lg"><Share2 size={16} /> Compartilhar</button>
                <a href={`https://youtu.be/${previewVideo.id}`} target="_blank" rel="noreferrer" className="bg-[#E5F20D] hover:bg-white text-black py-3.5 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(229,242,13,0.4)]"><Youtube size={18} /> Ver no YouTube</a>
             </div>
           </div>
        </div>
      )}
    </main>
  );
}