document.addEventListener('DOMContentLoaded', () => {
  
  //------------- SPINNER DE CARREGAMENTO -------------
  
  document.getElementById('loadingSpinner').style.display = 'flex';
    
  //------------- DECLARAÇÃO DE VARIÁVEIS -------------
  
  const Operacao = Object.freeze({
    VIDEOS: 'VIDEOS',
    ARTISTS: 'ARTISTS',
    PLAYLIST: 'PLAYLIST'
  });

  var operacaoSelecionada = Operacao.VIDEOS;

  var videos = []; //lista de vídeos/clipes vindo do json
  var genres = []; //lista de gêneros musicais
  let playlist = []; //lista de tocar
  
  // ----- Estado ----- 
  let filtered = [...videos]; //lista filtra de vídeos (pesquisa ou clique nos Chips)
  let currentIndex = 0;
  let isPlayingAll = false;
  let playerInstance = null;
  let playerReady = false;
  let activeGenre = 'Todos'; //gênero selecionado (Todos, Pop, MPB, Rock, etc)
  let currentPlaylistIndex = 0;
  let currentVideoId = '';
  let manterPlayerAberto = true;
      
  // ----- Elementos -----
  const grid = document.getElementById('grid');
  const chips = document.getElementById('chips');
  const search = document.getElementById('search');
  const searchArtists = document.getElementById('search-artist');
  const modal = document.getElementById('modal');
  const playerIframeWrap = document.getElementById('player-iframe');
  const closeBtn = document.getElementById('closeBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const playPauseBtn = document.getElementById('playPause');
  const openOnYT = document.getElementById('openOnYT');
  const errorBox = document.getElementById('errorBox');
  const themeToggle = document.getElementById('themeToggle');
  const playAllBtn = document.getElementById('playAll');
  const btnPlayPlaylist = document.getElementById('play-playlist');
  const btnClearPlaylist = document.getElementById('clear-playlist');
  
  //------------- OBTENÇÃO ASSÍNCRONA DO JSON -------------
  
  async function loadClipes(){
    //carrega o json com dados dos clipes
    try {
      const response = await fetch('db/clipes.json');
      
      if (!response.ok) {
        console.error("Fetch response:", response.status);
      } else {      
        return await response.json();    
      }
      
    } catch (error) {
      console.error('Erro ao carregar JSON:', error);
    }
    return null;
  }//loadClipes()

  // ---------- BOTÕES SELETORES: VIDEOS, ARTISTAS ou PLAYLIST --------------

  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick =() => {
      document.querySelectorAll(".tab,.tab-content").forEach(e => e.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      manterPlayerAberto = true;
      if (btn.id === "btn-videos") operacaoSelecionada = Operacao.VIDEOS;
      if (btn.id === "btn-artists") operacaoSelecionada = Operacao.ARTISTS;
      if (btn.id === "btn-playlist") operacaoSelecionada = Operacao.PLAYLIST;
    }
  }); //document.querySelectorAll

  // ---------- CRIA OS GÊNEROS MUSICAIS --------------
  
  function renderChips() {
    //monta a lista de gêneros musicais
    chips.innerHTML = '';
    const counts = {};
    var q = 0;
      
    counts['Todos'] = genres.count;

    videos.forEach(v => {
      const g = v.genre || "Todos";
      counts[g] = (counts[g] || 0) + 1;
      q = q + 1;
    });
      
    counts['Todos'] = q;

    Object.entries(counts).forEach(([genre, count]) => {
        const color = "#e91e63";
        const badge = document.createElement("div");                
          
        badge.className = 'chip-badge'+(genre===activeGenre?' active':'');
          
        badge.innerHTML = `
            <div class="chip-count" style="--badge-color:${color}">${count}</div>
            <div class="chip-name">${genre}</div>
        `;

        badge.onclick = () => {
           search.value = '';
           activeGenre = genre;
           applyFilter();
           renderChips();         
        };
          
        chips.appendChild(badge);
    });            
  }//renderChips()  

  // ---------- FILTRA OS VÍDEOS PELA PESQUISA OU CLICK NOS CHIPS --------------

  function applyFilter() {
    //monta a lista de clipes conforme filtragem
    const q = search.value.trim().toLowerCase(); //valor do campo de pesquisa
    
    if (q.length > 0 && activeGenre != 'Todos') { 
      // força a selecionar todos os gêneros musicais
      activeGenre = "Todos";
      renderChips();
    }
    
    filtered = videos.filter(v => (activeGenre==='Todos' || v.genre===activeGenre) && (`${v.title} ${v.artist} ${v.year}`.toLowerCase().includes(q)));
    
    renderGrid();
    updateTotal();
    renderArtists();
    localStorage.setItem('genre', activeGenre); //salva o gênero clicado    
  }

  // ---------- CRIA E EXIBE OS CARDS COM CADA VÍDEO --------------
  
  function renderGrid(){
    //monta a lista de clipes: todos ou conforme pesquisa ou gênero clicado
    grid.innerHTML = '';

    filtered.forEach((v, idx)=>{
      const c = document.createElement('div'); 
      c.className='card';
      
      c.innerHTML = `
        <div class="thumb" style="background-image:url('https://img.youtube.com/vi/${v.id}/hqdefault.jpg')"></div>
        <div class="badge">${v.genre}</div>
        <div class="meta">
          <div class="title">${v.title}</div>          
          <div class="sub">${v.artist} • ${v.year}</div>
        </div>
        <div class="eq" data-idx="${idx}">
          <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
        </div>
      `;

      // touch swipe hints: listen for swipes on card to navigate while modal closed
      let startX = 0, startY = 0;
      c.addEventListener('touchstart', e=>{startX=e.touches[0].clientX; startY=e.touches[0].clientY});
      c.addEventListener('touchend', e=>{const dx=e.changedTouches[0].clientX-startX; const dy=Math.abs(e.changedTouches[0].clientY-startY); if(Math.abs(dx)>60 && dy<40){ if(dx<0) openModal(idx) } });

      const btn = document.createElement("button");
      btn.className = "playlist-btn";
      btn.dataset.id = v.id;
      btn.textContent = "+";
      btn.title = "Adicionar à playlist";

      btn.addEventListener("click", e => {
        e.stopPropagation();
        togglePlaylist(v, btn);
      });
      
      c.appendChild(btn);
      
      //c.onclick = () => openModal(idx);
      c.addEventListener("click", e => {
        if (e.target.closest(".playlist-btn")) return;
        openModal(idx);
      });

      grid.appendChild(c);
    });
  }//renderGrid()
  
  // ---------- ATUALIZA MOSTRADOR TOTAL DE VÍDEOS --------------
  
  function updateTotal() {
    const el = document.getElementById('video-count');
    if (el) el.textContent = `${filtered.length} vídeos`;
  }

  //--------------------------------------------
  // ---------- PLAYER DO YOUTUBE --------------
  //--------------------------------------------
  
  function createPlayer(videoId){
    // Remove previous player if exists
    playerIframeWrap.innerHTML = '';
    const iframe = document.createElement('div'); iframe.id='yt-player'; playerIframeWrap.appendChild(iframe);
    currentVideoId = videoId;

    playerInstance = new YT.Player('yt-player', {
      height: '100%', 
      width: '100%', 
      videoId: videoId,
      playerVars: { 
        autoplay:1, 
        modestbranding:1, 
        rel:0, 
        playsinline:1      
      },
      events: {
        onReady: () => { 
          playerReady = true; 
          errorBox.style.display = 'none'; 
          playPauseBtn.textContent = '⏯️ Pausar'; /* ⏸️ */ 
          highlightPlaying(videoId);         
        },
        onStateChange: onPlayerStateChange,
        onError: onPlayerError
      }
    });
  }//createPlayer()

  function onPlayerStateChange(e){
    const state = e.data;
    // Playing
    if (state === YT.PlayerState.PLAYING){ 
      playPauseBtn.textContent='⏸️ Pausar'; 
      setEqualizer(true, currentVideoId);       
    }
    
    if (state === YT.PlayerState.PAUSED){ 
      playPauseBtn.textContent='▶️ Reproduzir'; 
      setEqualizer(false, currentVideoId);       
    }

    if (state === YT.PlayerState.ENDED){      
      setEqualizer(false, currentVideoId);

      if (isPlayingAll) {
        next();      
      } else {
        if (!manterPlayerAberto) closeModal();
      }
    }
  }//onPlayerStateChange()

  function onPlayerError(e){
    // 101 or 150 => embedding disabled
    const code = e.data;
    console.warn('YouTube Player error', code);
    
    if (code===101 || code===150){
      errorBox.style.display='block';
      errorBox.textContent = 'Este vídeo não permite incorporação (embed). Você pode abrir diretamente no YouTube.';
      openOnYT.style.display='inline-block';
    } else {
      errorBox.style.display='block';
      errorBox.textContent = 'Erro ao reproduzir o vídeo (código '+code+'). Tente abrir no YouTube.';
      openOnYT.style.display='inline-block';
    }
  }//onPlayerError()

  function openModal(idx){
    if (operacaoSelecionada === Operacao.VIDEOS){
      if (filtered.length===0) return;
      currentIndex = idx;
      const vid = filtered[currentIndex];
      playYoutubeVideo(vid.id);
    } else if (operacaoSelecionada = Operacao.PLAYLIST){
      if (playlist.length===0) return;
      currentIndex = idx;
      currentPlaylistIndex = idx;
      const vid = playlist[currentIndex];
      playYoutubeVideo(vid.id);
    }    
  }//openModal()

  function playYoutubeVideo(video_watch){
    if (video_watch.length===0) return;
    modal.style.display='flex';
    errorBox.style.display='none';
    openOnYT.style.display='none';
    
    // create player for this id
    if (window.YT && YT.Player){ 
      createPlayer(video_watch);     
    } else {
      // API not loaded yet — store the id and wait
      playerIframeWrap.innerHTML = `<iframe id="player-iframe-fallback" src="https://www.youtube.com/embed/${video_watch}?autoplay=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="position:absolute;inset:0;border:0;width:100%;height:100%;"></iframe>`;
    }    
  }//playYoutubeVideo()

  function closeModal(){
    modal.style.display = 'none';
    
    if (playerInstance && playerInstance.destroy) { 
      playerInstance.destroy(); 
      playerInstance = null; 
      playerReady = false;     
    }
    
    playerIframeWrap.innerHTML = '';
    setEqualizer(false, currentVideoId);
    currentIndex = 0;
    currentPlaylistIndex = 0;
  }//closeModal()

  function highlightPlaying(videoId = ""){
    // add .playing to eq for the current index
    if (operacaoSelecionada === Operacao.VIDEOS) {
      document.querySelectorAll('.eq').forEach(el => el.classList.remove('playing'));
      const eq = document.querySelectorAll('.eq')[currentIndex]; 
      if (eq) eq.classList.add('playing');
    } else if (operacaoSelecionada === Operacao.PLAYLIST) {
      playlist_EqualizerMarkPlaying(videoId);
    }
  }//highlightPlaying()

  function setEqualizer(on, videoId = ""){
    if (operacaoSelecionada === Operacao.VIDEOS){
      document.querySelectorAll('.eq')
       .forEach(el => { 
         if (on) {
           el.classList.add('playing');         
         } else {
           el.classList.remove('playing');     
         }
       });               
    } else if (operacaoSelecionada === Operacao.PLAYLIST) {
      playlist_EqualizerStopAllPlaying();
      
      if (on) {
        playlist_EqualizerMarkPlaying(videoId); 
      }     
    }
    
  }//setEqualizer()

  function prev(){
    if (operacaoSelecionada === Operacao.VIDEOS) {
      currentIndex = (currentIndex-1+filtered.length) % filtered.length; 
    } else if (operacaoSelecionada === Operacao.PLAYLIST) {
      currentIndex = (currentIndex-1+playlist.length) % playlist.length; 
      currentPlaylistIndex = currentIndex;
    }
    
    loadCurrent();   
  }

  function next(){
    if (operacaoSelecionada === Operacao.VIDEOS) {
      if (currentIndex < filtered.length - 1) {
         currentIndex = (currentIndex+1) % filtered.length;       
         loadCurrent();       
         return;
      }      
      if (!manterPlayerAberto) closeModal();
    } else if (operacaoSelecionada === Operacao.PLAYLIST) {
      if (currentIndex < playlist.length - 1) {
        playlist_next();
        loadCurrent(); 
        return;
      }      
      if (!manterPlayerAberto) closeModal();
    }        
  }//next()

  function loadCurrent(){ 
    let v = undefined;
    
    if (operacaoSelecionada === Operacao.VIDEOS) {
      v = filtered[currentIndex];
    } else if (operacaoSelecionada === Operacao.PLAYLIST) {
      v = playlist[currentIndex];
    }
    
    if (!v) return; 
    
    if (playerInstance && playerInstance.loadVideoById){ 
      playerInstance.loadVideoById(v.id);     
    } else { 
      playerIframeWrap.innerHTML = `<iframe id="player-iframe-fallback" src="https://www.youtube.com/embed/${v.id}?autoplay=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="position:absolute;inset:0;border:0;width:100%;height:100%;"></iframe>`;     
    }
    
    currentVideoId = v.id;
    highlightPlaying(v.id);   
  }//loadCurrent()

  // Play/pause
  function togglePlay(){ 
    if (!playerInstance){ 
      const f = document.getElementById('player-iframe-fallback'); 
      if (f){ /* cannot control fallback iframe */ } return;     
    }
    
    const state = playerInstance.getPlayerState();
    
    if (state === YT.PlayerState.PLAYING) {
      playerInstance.pauseVideo();       
    } else {
      playerInstance.playVideo();         
    }
  }//togglePlay()

  // Open on YouTube fallback
  openOnYT.addEventListener('click', () =>{
    if (operacaoSelecionada === Operacao.VIDEOS) {
      const v = filtered[currentIndex]; 
      window.open('https://www.youtube.com/watch?v='+v.id,'_blank');
    } else if (operacaoSelecionada === Operacao.PLAYLIST) {
      const v = playlist[currentIndex]; 
      window.open('https://www.youtube.com/watch?v='+v.id,'_blank');  
    }    
  });

  // Eventos Modal controls
  closeBtn.addEventListener('click', closeModal);
  prevBtn.addEventListener('click', ()=>{ prev(); });
  nextBtn.addEventListener('click', ()=>{ next(); });
  playPauseBtn.addEventListener('click', ()=>{ togglePlay(); });

  // keyboard navigation
  document.addEventListener('keydown', e => {
    if(modal.style.display==='flex'){
      if(e.key==='ArrowRight') next();
      if(e.key==='ArrowLeft') prev();
      if(e.key==='Escape') closeModal();
    }
  });

  // swipe to change when modal open
  let touchStartX = 0, touchStartY = 0;

  playerIframeWrap.addEventListener('touchstart', e => { 
    touchStartX = e.touches[0].clientX; 
    touchStartY = e.touches[0].clientY;   
    }, 
    {passive: true}  
  );

  playerIframeWrap.addEventListener('touchend', e =>{ 
      const dx = e.changedTouches[0].clientX-touchStartX; 
      const dy = Math.abs(e.changedTouches[0].clientY-touchStartY); 
      if (Math.abs(dx)>60 && dy<60){ if(dx<0) next(); else prev(); }   
    }, 
    {passive:true}  
  );

  // Theme toggle (neon/dark transition)
  let dark = true;
  themeToggle.addEventListener('click', ()=>{
    dark = !dark; if(dark){ document.documentElement.style.setProperty('--accent','#a2a7ff'); } else { document.documentElement.style.setProperty('--accent','#00d4ff'); }
  });

  // Play all
  playAllBtn.addEventListener('click', ()=>{ 
    isPlayingAll = !isPlayingAll; 
    playAllBtn.textContent = isPlayingAll? '⏸ Reproduzir tudo' : '▶ Reproduzir tudo'; 
    if(isPlayingAll && modal.style.display!=='flex'){ openModal(0); }  
  });

  // ----- Load YouTube IFrame API and setup global handlers -----
  function onYouTubeIframeAPIReady(){
    // expose globally so YT can call it
  }
  
  //------------------------------------
  //------------- ARTISTAS -------------
  //------------------------------------
  
  function renderArtists() {
    //const container = document.querySelector(".artists-grid");
    const c = document.getElementById("artists-list");
    c.innerHTML = "";
    const artistas = {};
    
    const q = searchArtists.value.trim().toLowerCase(); //valor do campo de pesquisa
                
    videos.forEach(v => {
      if ((v.artist || "").toLowerCase().includes(q) || 
          (v.title || "").toLowerCase().includes(q) ||
          String(v.year).includes(q)
         ) {
           if(!artistas[v.artist]) artistas[v.artist]=[];
           artistas[v.artist].push(v);
      }//if      
    });    

    Object.keys(artistas)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })) // ordena pelo nome do artista
      .forEach(artista => {
          const div = document.createElement("div");      
          div.className="artist-card";
          div.innerHTML = `
            <img class="artist-cover" src="https://img.youtube.com/vi/${artistas[artista][0].id}/hqdefault.jpg">
            <div class="artist-info">
              <h3>${artista}</h3>
              <ul></ul>
            </div>
          `;
          
          const ul = div.querySelector("ul");

          artistas[artista].forEach(v => {
            const li = document.createElement("li");
            li.textContent = `${v.year} • ${v.title}`;
            li.addEventListener("click", () => playYoutubeVideo(v.id));
            ul.appendChild(li);
          });
          
          c.appendChild(div);
    });//forEach
    
    if (artistas.length>0){
      document.querySelector('[data-tab="artists"]').textContent = `🎤 Artistas (${artistas.length})`;
    } else {
      document.querySelector('[data-tab="artists"]').textContent = `🎤 Artistas`;
    }
  }//renderArtists()

  //------------------------------------
  //------------- PLAYLIST -------------
  //------------------------------------
  
  btnPlayPlaylist.addEventListener("click", play_Playlist);
  btnClearPlaylist.addEventListener("click", clearPlaylist);

  function togglePlaylist(obj_video, btn) {
    //controle de adicionar/remover à playlist
    const index = playlist.findIndex(v => v.id === obj_video.id);

    if (index === -1) {
      playlist.push(obj_video);
      btn.textContent = "-";
      btn.title = "Remover da playlist";
      btn.classList.add("remove");
    } else {
      playlist.splice(index, 1);
      btn.textContent = "+";
      btn.title = "Adicionar à playlist";
      btn.classList.remove("remove");
    }
    
    //console.log("objeto", obj_video);
    
    // força reflow para reiniciar animação
    btn.classList.remove("animate");
    void btn.offsetWidth;
    btn.classList.add("animate");
    
    savePlaylist();
    renderPlaylist();    
  }//togglePlaylist
  
  function updatePlaylistButtons() {
    //Atualizar ícones no card da aba videos
    document.querySelectorAll(".playlist-btn").forEach(btn => {
      const index = btn.dataset.id;
      const exists = playlist.some(v => v.id === index);
      btn.textContent = exists ? "-" : "+";
      btn.title = exists ? "Adicionar à playlist" : "Remover da playlist";      
    });
  }//updatePlaylistButtons()

  function savePlaylist() {
    localStorage.setItem("playlist", JSON.stringify(playlist));
    localStorage.setItem("playlistindex", currentPlaylistIndex);    
  }//savePlaylist()
  
  function loadSavedPlaylist() {
    playlist = JSON.parse( localStorage.getItem("playlist")||"[]" );
    currentPlaylistIndex = localStorage.getItem("playlistindex")||0;
    //console.log("Arquivo Playlist", playlist[0]);
  }//loadSavedPlaylist()
  
  function renderPlaylist() {
    const c = document.getElementById("playlist-list");
    c.innerHTML = "";
    
    //console.log("playlist_length: ", playlist.length);
    
    playlist.forEach((a, i) => {
      //console.log("artista:", a.artist);
      const div = document.createElement("div");      
      div.className="playlist-card";
      div.innerHTML = `
       <img class="artist-cover" src="https://img.youtube.com/vi/${a.id}/hqdefault.jpg">
       <div class="eq_playlist" data-id="${a.id}">
        <span></span><span></span><span></span><span></span>
       </div>
       <div class="artist-info">
        <h3>${a.artist}</h3><ul></ul>
       </div>       
      `;
      
      const ul = div.querySelector("ul");    
      const li = document.createElement("li");
      
      li.textContent = `${a.year} • ${a.title}`;
      li.addEventListener("click", () => playYoutubeVideo(a.id));
      ul.appendChild(li);
            
      c.appendChild(div);
    });
    
    if (playlist.length>0){
      document.querySelector('[data-tab="playlist"]').textContent = `📜 Playlist (${playlist.length})`;
    } else {
      document.querySelector('[data-tab="playlist"]').textContent = `📜 Playlist`;
    }
    
    updatePlaylistActions();
  }//renderPlaylist()
  
  function play_Playlist() {
    //inicia a execução da lista
    if (!playlist.length) return;    

    savePlaylist();
    isPlayingAll = true;
    manterPlayerAberto = false;
    currentPlaylistIndex = 0;
    currentIndex = 0;
    playYoutubeVideo( playlist[0].id );
  }//playPlaylist()
  
  function playlist_next() {
    //evento do youtube player
    currentIndex = (currentIndex+1) % playlist.length; 
    currentPlaylistIndex = currentIndex;
    localStorage.setItem("playlistindex", currentPlaylistIndex);
  }//onVideoEnded()
  
  function clearPlaylist() {
    playlist = [];
    currentPlaylistIndex = 0;
    currentIndex = 0;
    isPlayingAll = false;
    savePlaylist();
    renderPlaylist();
    updatePlaylistButtons();
    playlist_EqualizerStopAllPlaying();
  }//clearPlaylist()
  
  function updatePlaylistActions() {
    const hasItems = playlist.length > 0;
    document.querySelector(".btn-play-all").disabled = !hasItems;
    document.querySelector(".btn-clear").disabled = !hasItems;
  }//updatePlaylistActions
  
  function playlist_EqualizerMarkPlaying(videoId) {
    const pl = document.querySelector(".playlist-card");
    pl.querySelectorAll(".eq_playlist")
      .forEach(item => {
        /* item.classList.toggle("playlist_playing", item.dataset.id === videoId); */        
        if (item.dataset.id === videoId){
          item.classList.add("playlist_playing");
        } else {
          item.classList.remove("playlist_playing");  
        }
      });
  }//playlist_EqualizerMarkPlaying
  
  function playlist_EqualizerStopAllPlaying() {
    const pl = document.querySelector(".playlist-card");
    pl.querySelectorAll(".eq_playlist")
      .forEach(item => {
         item.classList.remove("playlist_playing");        
      });
  }//playlist_EqualizerStopAllPlaying

  //------------- EVENTO DE PESQUISA ---------

  search.addEventListener('input', applyFilter);
  
  searchArtists.addEventListener('input', renderArtists);
  
  //-----------------------------------------
  //------------- INICIALIZAÇÃO -------------
  //-----------------------------------------

  loadClipes()
    .then(data => {
      videos = data;
      
      operacaoSelecionada = Operacao.VIDEOS;
      manterPlayerAberto = true;
      
      // ordena pelo nome da música
      videos.sort((a, b) => a.title.localeCompare(b.title));
      
      filtered = [...videos];
      
      //recupera o gênero clicado na última vez, salvo
      activeGenre = localStorage.getItem('genre') || 'Todos'; 
      
      // ----- Gêneros Musicais -----
      genres = ['Todos', ...Array.from(new Set(videos.map(v => v.genre)))];     
    
      //cria chips de gêneros musicais com a quantidade
      renderChips(); 
      
      //Cria os cards dos vídeos filtrados ou não
      applyFilter();
      
      //artistas
      renderArtists();
      
      //playlist
      loadSavedPlaylist();
      renderPlaylist();      
          
      // Expose helpers for debugging
      window._app = { videos, filtered };

      document.getElementById('loadingSpinner').style.display = 'none';    
    })
    .catch(erro => {
       document.getElementById('loadingSpinner').style.display = 'none';
    }); //loadClipes()
    
}); //document.addEventListener()


