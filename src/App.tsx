import { useState, useEffect, useRef } from 'react';
import './App.css';

interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  overview: string;
}

interface Actor {
  name: string;
}

function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedMovies, setLikedMovies] = useState<Movie[]>([]);
  const [lastLiked, setLastLiked] = useState<Movie | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);
  const [actors, setActors] = useState<Actor[]>([]);
  const [currentTab, setCurrentTab] = useState<'swipe' | 'matches' | 'watch' | 'prefs'>('swipe');

  const [matchesSubTab, setMatchesSubTab] = useState<'mutual' | 'my-likes'>('mutual');

  // Watch Together
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinedCode, setJoinedCode] = useState('');
  const [roomStatus, setRoomStatus] = useState('Create or join a room to watch together!');
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);

  // Preferences
  const [genrePrefs, setGenrePrefs] = useState<Record<string, number>>({
    Action: 50, Adventure: 50, Animation: 50, Comedy: 70, Crime: 50,
    Drama: 50, Fantasy: 50, Horror: 50, Mystery: 50, Romance: 50,
    SciFi: 50, Thriller: 50, War: 50, Western: 50
  });

  const [eraPrefs, setEraPrefs] = useState<Record<string, boolean>>({
    '1920s': false, '1930s': false, '1940s': false, '1950s': false,
    '1960s': false, '1970s': false, '1980s': false, '1990s': false,
    '2000s': false, '2010s': false, '2020s': true
  });

  const [favoriteActors, setFavoriteActors] = useState<string[]>([]);
  const [newActor, setNewActor] = useState('');

  const cardRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isFlyingOff, setIsFlyingOff] = useState(false);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);

  const currentMovie = movies[currentIndex];

  const fetchMovies = async () => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    if (!apiKey) return;

    let url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=popularity.desc`;

    const activeGenres = Object.keys(genrePrefs).filter(g => genrePrefs[g] > 60);
    if (activeGenres.length > 0) {
      const genreIds = activeGenres.map(g => {
        const map: Record<string, number> = { Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80, Drama: 18, Fantasy: 14, Horror: 27, Mystery: 9648, Romance: 10749, SciFi: 878, Thriller: 53, War: 10752, Western: 37 };
        return map[g];
      }).join(',');
      url += `&with_genres=${genreIds}`;
    }

    const activeEras = Object.keys(eraPrefs).filter(e => eraPrefs[e]);
    if (activeEras.length > 0) {
      let minYear = 2020, maxYear = 2025;
      if (activeEras.includes('1920s')) { minYear = 1920; maxYear = 1929; }
      else if (activeEras.includes('1930s')) { minYear = 1930; maxYear = 1939; }
      else if (activeEras.includes('1940s')) { minYear = 1940; maxYear = 1949; }
      else if (activeEras.includes('1950s')) { minYear = 1950; maxYear = 1959; }
      else if (activeEras.includes('1960s')) { minYear = 1960; maxYear = 1969; }
      else if (activeEras.includes('1970s')) { minYear = 1970; maxYear = 1979; }
      else if (activeEras.includes('1980s')) { minYear = 1980; maxYear = 1989; }
      else if (activeEras.includes('1990s')) { minYear = 1990; maxYear = 1999; }
      else if (activeEras.includes('2000s')) { minYear = 2000; maxYear = 2009; }
      else if (activeEras.includes('2010s')) { minYear = 2010; maxYear = 2019; }
      url += `&primary_release_date.gte=${minYear}-01-01&primary_release_date.lte=${maxYear}-12-31`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      setMovies(data.results || []);
      setCurrentIndex(0);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, [genrePrefs, eraPrefs]);

  const fetchActors = async (movieId: number) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    if (!apiKey) return;
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${apiKey}`);
      const data = await res.json();
      setActors(data.cast ? data.cast.slice(0, 8).map((c: any) => ({ name: c.name })) : []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (showDetails && detailMovie) {
      fetchActors(detailMovie.id);
    }
  }, [showDetails, detailMovie]);

  const triggerFlyOff = (liked: boolean) => {
    if (!currentMovie || !cardRef.current) return;
    if (liked) {
      setLikedMovies(prev => [...prev, currentMovie]);
      setLastLiked(currentMovie);
    }
    const card = cardRef.current;
    setIsFlyingOff(true);
    setFlyDirection(liked ? 'right' : 'left');
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % movies.length);
      setIsFlyingOff(false);
      setFlyDirection(null);
      setDragOffset(0);
    }, 550);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setStartX(e.clientX);
    setDragOffset(0);
    cardRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startX === 0 || isFlyingOff) return;
    const delta = e.clientX - startX;
    setDragOffset(delta);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (isFlyingOff) return;
    const delta = dragOffset;
    if (Math.abs(delta) > 120) {
      triggerFlyOff(delta > 0);
    } else {
      setDragOffset(0);
    }
    setStartX(0);
  };

  const handleUndo = () => {
    if (lastLiked) {
      setLikedMovies(prev => prev.filter(m => m.id !== lastLiked.id));
      setLastLiked(null);
      setCurrentIndex(prev => (prev - 1 + movies.length) % movies.length);
    }
  };

  const createRoom = () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomCode(newCode);
    setRoomStatus(`Room created! Code: ${newCode}`);
    setIsInRoom(true);
    setChatMessages([`Room ${newCode} created. Share this code with your partner.`]);
  };

  const joinRoom = () => {
    if (joinedCode.length === 6) {
      setRoomCode(joinedCode);
      setRoomStatus(`Joined room ${joinedCode}`);
      setIsInRoom(true);
      setChatMessages([`Joined room ${joinedCode}. Say hello!`]);
    } else {
      setRoomStatus('Please enter a valid 6-digit code');
    }
  };

  const sendChatMessage = () => {
    if (newChatMessage.trim()) {
      setChatMessages(prev => [...prev, `You: ${newChatMessage}`]);
      setNewChatMessage('');
      setTimeout(() => {
        setChatMessages(prev => [...prev, `Partner: That sounds good!`]);
      }, 800);
    }
  };

  const savePreferences = () => {
    alert('Preferences saved!');
  };

  const addActor = () => {
    if (newActor.trim()) {
      setFavoriteActors(prev => [...prev, newActor.trim()]);
      setNewActor('');
    }
  };

  const removeActor = (actor: string) => {
    setFavoriteActors(prev => prev.filter(a => a !== actor));
  };

  return (
    <div className="app">
      <div className="header">
        <div className="logo">DuoFlix</div>
        <div className="likes">❤️ {likedMovies.length}</div>
      </div>

      {currentTab === 'swipe' && (
        <div className="swipe-page">
          <div className="poster-container">
            {currentMovie && (
              <div
                ref={cardRef}
                className={`poster-card ${isFlyingOff ? (flyDirection === 'right' ? 'flying-off-right' : 'flying-off-left') : ''}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{ transform: `translateX(${dragOffset}px) rotate(${dragOffset / 20}deg)` }}
              >
                <img
                  className="poster-img"
                  src={`https://image.tmdb.org/t/p/w780${currentMovie.poster_path}`}
                  alt={currentMovie.title}
                />
                <div className="overlay">
                  <div className="title">{currentMovie.title}</div>
                  <div className="meta">
                    {currentMovie.release_date?.slice(0,4) || 'N/A'} • {currentMovie.vote_average?.toFixed(1) || '0'} ★
                  </div>
                </div>
              </div>
            )}
          </div>

          {!showDetails && (
            <div className="button-layer">
              <button className="btn undo" onClick={handleUndo}>↩</button>
              <button className="btn details" onClick={() => { setDetailMovie(currentMovie); setShowDetails(true); }}>Details</button>
              <button className="btn nope" onClick={() => triggerFlyOff(false)}>✕</button>
              <button className="btn like" onClick={() => triggerFlyOff(true)}>♥</button>
            </div>
          )}

          {showDetails && detailMovie && (
            <div className="modal-overlay" onClick={() => setShowDetails(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={() => setShowDetails(false)}>×</button>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '0.8rem', color: 'white' }}>{detailMovie.title}</h2>
                <p className="modal-meta">
                  {detailMovie.release_date?.slice(0,4) || 'N/A'} • {detailMovie.vote_average?.toFixed(1) || '0'} ★
                </p>
                <p className="modal-description">{detailMovie.overview}</p>
                <h3>Top Actors</h3>
                <ul className="actors-list">
                  {actors.length > 0 ? actors.map((a, i) => <li key={i}>{a.name}</li>) : <li>Loading actors...</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {currentTab === 'matches' && (
        <div className="matches-page">
          <div className="matches-tabs">
            <button className={matchesSubTab === 'mutual' ? 'active' : ''} onClick={() => setMatchesSubTab('mutual')}>Mutual Matches</button>
            <button className={matchesSubTab === 'my-likes' ? 'active' : ''} onClick={() => setMatchesSubTab('my-likes')}>My Likes</button>
          </div>
          {matchesSubTab === 'my-likes' && (
            <div className="matches-grid">
              {likedMovies.map(movie => (
                <div key={movie.id} className="match-card">
                  <img className="match-img" src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} alt={movie.title} />
                  <div className="match-overlay">{movie.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentTab === 'watch' && (
        <div className="watch-page">
          <h2>Watch Together</h2>
          
          {!isInRoom ? (
            <>
              <p>{roomStatus}</p>
              
              <input 
                type="text" 
                value={joinedCode} 
                onChange={e => setJoinedCode(e.target.value)} 
                placeholder="Enter 6-digit room code" 
                maxLength={6}
                style={{ display: 'block', width: '100%', maxWidth: '280px', margin: '0 auto 1.5rem', padding: '0.9rem 1rem', background: '#111', border: '1px solid #444', borderRadius: '12px', color: 'white', textAlign: 'center' }}
              />
              
              <button 
                style={{ display: 'block', width: '100%', maxWidth: '280px', margin: '0.8rem auto', padding: '1rem 2rem', fontSize: '1.2rem', fontWeight: '600', border: 'none', borderRadius: '999px', background: '#3b82f6', color: 'white' }}
                onClick={joinRoom}
              >
                Join Room
              </button>
              
              <button 
                style={{ display: 'block', width: '100%', maxWidth: '280px', margin: '0.8rem auto', padding: '1rem 2rem', fontSize: '1.2rem', fontWeight: '600', border: 'none', borderRadius: '999px', background: '#22c55e', color: 'white' }}
                onClick={createRoom}
              >
                Create New Room
              </button>
            </>
          ) : (
            <>
              <p>Room Code: <strong>{roomCode}</strong></p>
              <div style={{ margin: '2rem 0', padding: '1rem', background: '#111', borderRadius: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: '0.8rem', textAlign: 'left' }}>{msg}</div>
                ))}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  value={newChatMessage} 
                  onChange={e => setNewChatMessage(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..." 
                  style={{ flex: 1, padding: '0.9rem', background: '#111', border: '1px solid #444', borderRadius: '12px', color: 'white' }}
                />
                <button onClick={sendChatMessage} style={{ padding: '0 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px' }}>
                  Send
                </button>
              </div>
              
              <button 
                style={{ marginTop: '1.5rem', background: '#ef4444', color: 'white', width: '100%', padding: '1rem', border: 'none', borderRadius: '999px' }}
                onClick={() => { setIsInRoom(false); setRoomCode(null); setChatMessages([]); setRoomStatus('Create or join a room to watch together!'); }}
              >
                Leave Room
              </button>
            </>
          )}
        </div>
      )}

      {currentTab === 'prefs' && (
        <div className="prefs-page">
          <div className="prefs-container">
            <h2>Preferences</h2>
            {Object.keys(genrePrefs).map(genre => (
              <div key={genre} className="slider-row">
                <label>{genre}</label>
                <input type="range" min="0" max="100" value={genrePrefs[genre]} onChange={e => setGenrePrefs(prev => ({...prev, [genre]: Number(e.target.value)}))} />
              </div>
            ))}
            <div className="actor-input">
              <input value={newActor} onChange={e => setNewActor(e.target.value)} placeholder="Add favorite actor" />
              <button onClick={addActor}>Add</button>
            </div>
            <ul className="actor-list">
              {favoriteActors.map(actor => (
                <li key={actor}>
                  {actor}
                  <button onClick={() => removeActor(actor)}>Remove</button>
                </li>
              ))}
            </ul>
            <div className="era-grid">
              {Object.keys(eraPrefs).map(era => (
                <label key={era} className="era-label">
                  <input type="checkbox" checked={eraPrefs[era]} onChange={e => setEraPrefs(prev => ({...prev, [era]: e.target.checked}))} />
                  {era}
                </label>
              ))}
            </div>
            <button className="save-btn" onClick={savePreferences}>Save Preferences</button>
          </div>
        </div>
      )}

      <nav className="tab-bar">
        <button onClick={() => setCurrentTab('swipe')}>Swipe</button>
        <button onClick={() => setCurrentTab('matches')}>Matches</button>
        <button onClick={() => setCurrentTab('watch')}>Watch</button>
        <button onClick={() => setCurrentTab('prefs')}>Prefs</button>
      </nav>
    </div>
  );
}

export default App;