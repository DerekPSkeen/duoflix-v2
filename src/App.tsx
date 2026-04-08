import { useState, useEffect, useRef } from 'react';
import './App.css';
import { supabase } from './supabaseClient';

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
  const [sharedLikes, setSharedLikes] = useState<Movie[]>([]);
  const [mutualMatches, setMutualMatches] = useState<Movie[]>([]);
  const [lastLiked, setLastLiked] = useState<Movie | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);
  const [actors, setActors] = useState<Actor[]>([]);
  const [currentTab, setCurrentTab] = useState<'swipe' | 'matches' | 'watch' | 'prefs'>('swipe');

  const [matchesSubTab, setMatchesSubTab] = useState<'mutual' | 'my-likes'>('mutual');

  // Watch Together + Persistent Couple Code
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [coupleCode, setCoupleCode] = useState<string | null>(null);
  const [joinedCode, setJoinedCode] = useState('');
  const [roomStatus, setRoomStatus] = useState('Create or join a room to watch together!');
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);

  // Realtime channel
  const channelRef = useRef<any>(null);

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

  // Landing + Auth
  const [showLanding, setShowLanding] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isFlyingOff, setIsFlyingOff] = useState(false);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);

  const currentMovie = movies[currentIndex];

  // Clean auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load coupleCode: prefer user-linked from Supabase (if logged in), then localStorage
  useEffect(() => {
    const loadCoupleCode = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('user_couple_codes')
          .select('couple_code')
          .eq('user_id', user.id)
          .single();

        if (data?.couple_code) {
          setCoupleCode(data.couple_code);
          localStorage.setItem('duoflix_couple_code', data.couple_code);
          return;
        }
      }

      const saved = localStorage.getItem('duoflix_couple_code');
      if (saved) setCoupleCode(saved);
    };

    loadCoupleCode();
  }, [user]);

  // Realtime channel for shared chat and likes
  useEffect(() => {
    if (!isInRoom || !roomCode) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channelName = `room-${roomCode}`;
    const channel = supabase.channel(channelName);

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (payload.message) setChatMessages(prev => [...prev, payload.message]);
    });

    channel.on('broadcast', { event: 'like' }, ({ payload }) => {
      if (payload.movie) {
        setSharedLikes(prev => {
          const exists = prev.some(m => m.id === payload.movie.id);
          return exists ? prev : [...prev, payload.movie];
        });
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [isInRoom, roomCode]);

  // Mutual matches
  useEffect(() => {
    const mutual = likedMovies.filter(my => 
      sharedLikes.some(partner => partner.id === my.id)
    );
    setMutualMatches(mutual);
  }, [likedMovies, sharedLikes]);

  // Load persistent likes from Supabase when coupleCode is available
  useEffect(() => {
    if (!coupleCode) return;

    supabase
      .from('couple_likes')
      .select('movie_data')
      .eq('couple_code', coupleCode)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load persistent likes:', error);
          return;
        }
        if (data && data.length > 0) {
          const loadedMovies: Movie[] = data.map((item: any) => item.movie_data as Movie);
          setLikedMovies(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = loadedMovies.filter((m: Movie) => !existingIds.has(m.id));
            return [...prev, ...newOnes];
          });
        }
      });
  }, [coupleCode]);

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
      const alreadyLiked = likedMovies.some(m => m.id === currentMovie.id);
      if (!alreadyLiked && currentMovie) {
        setLikedMovies(prev => [...prev, currentMovie]);
        setLastLiked(currentMovie);

        if (coupleCode) {
          supabase
            .from('couple_likes')
            .upsert({
              couple_code: coupleCode,
              movie_id: currentMovie.id,
              movie_data: currentMovie
            }, { onConflict: 'couple_code,movie_id' })
            .then(({ error }) => {
              if (error) console.error('Failed to save persistent like:', error);
            });
        }

        if (isInRoom && roomCode && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'like',
            payload: { movie: currentMovie }
          });
        }
      }
    }

    setIsFlyingOff(true);
    setFlyDirection(liked ? 'right' : 'left');
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % movies.length);
      setIsFlyingOff(false);
      setFlyDirection(null);
      setDragOffset(0);
    }, 550);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isFlyingOff) return;
    setStartX(e.clientX);
    setDragOffset(0);
    cardRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isFlyingOff || startX === 0) return;
    e.preventDefault();
    const delta = e.clientX - startX;
    setDragOffset(delta);
  };

  const handlePointerUp = () => {
    if (isFlyingOff) return;
    const delta = dragOffset;
    if (Math.abs(delta) > 100) {
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

  const createRoom = async () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomCode(newCode);
    setCoupleCode(newCode);
    localStorage.setItem('duoflix_couple_code', newCode);

    if (user?.id) {
      await supabase
        .from('user_couple_codes')
        .upsert({ user_id: user.id, couple_code: newCode });
    }

    setRoomStatus(`Room created! Code: ${newCode} (permanent couple code)`);
    setIsInRoom(true);
    setChatMessages([`Room ${newCode} created. Share this code with your partner.`]);
  };

  const joinRoom = async () => {
    if (joinedCode.length === 6) {
      setRoomCode(joinedCode);
      setCoupleCode(joinedCode);
      localStorage.setItem('duoflix_couple_code', joinedCode);

      if (user?.id) {
        await supabase
          .from('user_couple_codes')
          .upsert({ user_id: user.id, couple_code: joinedCode });
      }

      setRoomStatus(`Joined room ${joinedCode} (couple code saved)`);
      setIsInRoom(true);
      setChatMessages([`Joined room ${joinedCode}. Say hello!`]);
    } else {
      setRoomStatus('Please enter a valid 6-digit code');
    }
  };

  const sendChatMessage = () => {
    if (newChatMessage.trim() && isInRoom && roomCode && channelRef.current) {
      const message = `You: ${newChatMessage}`;
      setChatMessages(prev => [...prev, message]);

      channelRef.current.send({
        type: 'broadcast',
        event: 'chat',
        payload: { message: `Partner: ${newChatMessage}` }
      });

      setNewChatMessage('');
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCoupleCode(null);
    localStorage.removeItem('duoflix_couple_code');
    setShowLanding(true);
  };

  const handleAuth = async () => {
    setIsLoading(true);
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) alert(error.message);
        else alert('Check your email for confirmation!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
      }
      setShowAuthModal(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      alert('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (showLanding) {
    return (
      <div className="app" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'linear-gradient(180deg, #111 0%, #000 100%)' }}>
        <div style={{ fontSize: '2.4rem', lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.03em', maxWidth: '320px', marginBottom: '48px' }}>
          Stop arguing.<br />Start watching together.
        </div>
        <button onClick={() => setShowLanding(false)} style={{ background: '#fff', color: '#000', fontWeight: 600, fontSize: '1.25rem', padding: '18px 48px', borderRadius: '9999px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', border: 'none', marginBottom: '20px' }}>
          Open DuoFlix Now
        </button>
        <button onClick={() => { setShowLanding(false); setShowAuthModal(true); setAuthMode('login'); }} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.5)', padding: '12px 32px', borderRadius: '9999px', fontSize: '1rem' }}>
          Sign In / Create Account
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="logo" onClick={() => setShowLanding(true)} style={{ cursor: 'pointer' }}>DuoFlix</div>
        {user && (
          <div style={{ fontSize: '0.9rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px' }}>
            👤 {user.email}
            <button 
              onClick={handleLogout}
              style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        )}
        <div className="likes" onClick={() => setCurrentTab('matches')} style={{ cursor: 'pointer' }}>❤️ Matches</div>
      </div>

      {currentTab === 'swipe' && (
        <div className="swipe-page">
          <div className="poster-container">
            {currentMovie && (
              <div
                ref={cardRef}
                className={`poster-card ${isFlyingOff ? (flyDirection === 'right' ? 'flying-off-right' : 'flying-off-left') : ''}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ transform: `translateX(${dragOffset}px) rotate(${dragOffset / 20}deg)`, touchAction: 'none' }}
              >
                <img
                  className="poster-img"
                  src={`https://image.tmdb.org/t/p/w780${currentMovie.poster_path}`}
                  alt={currentMovie.title}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
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
          <div className="matches-grid">
            {/* Mutual Matches */}
            {matchesSubTab === 'mutual' && mutualMatches.map(movie => (
              <button
                key={movie.id}
                className="match-card"
                onClick={() => {
                  console.log('Opening modal for mutual match:', movie.title);
                  setDetailMovie(movie);
                  setShowDetails(true);
                }}
              >
                <img 
                  className="match-img" 
                  src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} 
                  alt={movie.title} 
                />
                <div className="match-overlay">
                  <div className="match-title">{movie.title}</div>
                  <div className="match-meta">
                    {movie.release_date?.slice(0,4) || 'N/A'} • {movie.vote_average?.toFixed(1) || '0'} ★
                  </div>
                  <div className="match-details-btn">Details</div>
                </div>
              </button>
            ))}
            {/* My Likes */}
            {matchesSubTab === 'my-likes' && likedMovies.map(movie => (
              <button
                key={movie.id}
                className="match-card"
                onClick={() => {
                  console.log('Opening modal for my like:', movie.title);
                  setDetailMovie(movie);
                  setShowDetails(true);
                }}
              >
                <img 
                  className="match-img" 
                  src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} 
                  alt={movie.title} 
                />
                <div className="match-overlay">
                  <div className="match-title">{movie.title}</div>
                  <div className="match-meta">
                    {movie.release_date?.slice(0,4) || 'N/A'} • {movie.vote_average?.toFixed(1) || '0'} ★
                  </div>
                  <div className="match-details-btn">Details</div>
                </div>
              </button>
            ))}
            {/* Empty states */}
            {matchesSubTab === 'mutual' && mutualMatches.length === 0 && (
              <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.7 }}>No mutual matches yet. Both swipe right on the same movie!</p>
            )}
            {matchesSubTab === 'my-likes' && likedMovies.length === 0 && (
              <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.7 }}>No likes yet. Start swiping!</p>
            )}
          </div>
        </div>
      )}

      {currentTab === 'watch' && (
        <div className="watch-page">
          <h2>Watch Together</h2>
          {!isInRoom ? (
            <>
              <p>{roomStatus}</p>
              <input type="text" className="room-input" value={joinedCode} onChange={e => setJoinedCode(e.target.value)} placeholder="Enter 6-digit room code" maxLength={6} />
              <button className="watch-btn join" onClick={joinRoom}>Join Room</button>
              <button className="watch-btn create" onClick={createRoom}>Create New Room</button>
            </>
          ) : (
            <>
              <p>Room Code: <strong>{roomCode}</strong></p>
              <div style={{ margin: '2rem 0', padding: '1rem', background: '#111', borderRadius: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {chatMessages.map((msg, i) => <div key={i} style={{ marginBottom: '0.8rem', textAlign: 'left' }}>{msg}</div>)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" value={newChatMessage} onChange={e => setNewChatMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendChatMessage()} placeholder="Type a message..." style={{ flex: 1, padding: '0.9rem', background: '#111', border: '1px solid #444', borderRadius: '12px', color: 'white' }} />
                <button onClick={sendChatMessage} style={{ padding: '0 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px' }}>Send</button>
              </div>
              <button style={{ marginTop: '1.5rem', background: '#ef4444', color: 'white' }} className="watch-btn" onClick={() => { setIsInRoom(false); setRoomCode(null); setChatMessages([]); setRoomStatus('Create or join a room to watch together!'); }}>Leave Room</button>
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

      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowAuthModal(false)}>×</button>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', background: '#111', border: '1px solid #444', borderRadius: '8px', color: 'white' }} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', background: '#111', border: '1px solid #444', borderRadius: '8px', color: 'white' }} />
            <button onClick={handleAuth} disabled={isLoading} style={{ width: '100%', padding: '14px', background: '#22c55e', color: '#000', border: 'none', borderRadius: '999px', fontWeight: 600 }}>
              {isLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem' }}>
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <span onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} style={{ color: '#3b82f6', cursor: 'pointer' }}>{authMode === 'login' ? 'Sign up' : 'Sign in'}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;