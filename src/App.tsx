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

  // Per-user Preferences
  const [myPrefs, setMyPrefs] = useState<Record<string, number>>({
    Action: 50, Adventure: 50, Animation: 50, Comedy: 70, Crime: 50,
    Drama: 50, Fantasy: 50, Horror: 50, Mystery: 50, Romance: 50,
    SciFi: 50, Thriller: 50, War: 50, Western: 50
  });

  const [partnerPrefs, setPartnerPrefs] = useState<Record<string, number>>({
    Action: 50, Adventure: 50, Animation: 50, Comedy: 70, Crime: 50,
    Drama: 50, Fantasy: 50, Horror: 50, Mystery: 50, Romance: 50,
    SciFi: 50, Thriller: 50, War: 50, Western: 50
  });

  const [myEraPrefs, setMyEraPrefs] = useState<Record<string, boolean>>({
    '1920s': false, '1930s': false, '1940s': false, '1950s': false,
    '1960s': false, '1970s': false, '1980s': false, '1990s': false,
    '2000s': false, '2010s': false, '2020s': true
  });

  const [partnerEraPrefs, setPartnerEraPrefs] = useState<Record<string, boolean>>({
    '1920s': false, '1930s': false, '1940s': false, '1950s': false,
    '1960s': false, '1970s': false, '1980s': false, '1990s': false,
    '2000s': false, '2010s': false, '2020s': true
  });

  const [myFavoriteActors, setMyFavoriteActors] = useState<string[]>([]);
  const [partnerFavoriteActors, setPartnerFavoriteActors] = useState<string[]>([]);
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

  // Load coupleCode
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

  // Client-side blend fetchMovies - ONLY CHANGE
  const fetchMovies = async () => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    if (!apiKey) return;

    const allResults: Movie[] = [];

    // Helper to fetch multiple pages
    const fetchPages = async (baseUrl: string, maxPages: number = 3) => {
      const results: Movie[] = [];
      for (let page = 1; page <= maxPages; page++) {
        try {
          const url = `${baseUrl}&page=${page}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            results.push(...data.results);
          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }
      return results;
    };

    // Calculate year range from eras (wide if none selected)
    const mergedEras = { ...myEraPrefs, ...partnerEraPrefs };
    const activeEras = Object.keys(mergedEras).filter(e => mergedEras[e]);
    let minYear = 1990;
    let maxYear = 2026;
    if (activeEras.length > 0) {
      const yearMap: Record<string, {min: number; max: number}> = {
        '1920s': {min: 1920, max: 1929},
        '1930s': {min: 1930, max: 1939},
        '1940s': {min: 1940, max: 1949},
        '1950s': {min: 1950, max: 1959},
        '1960s': {min: 1960, max: 1969},
        '1970s': {min: 1970, max: 1979},
        '1980s': {min: 1980, max: 1989},
        '1990s': {min: 1990, max: 1999},
        '2000s': {min: 2000, max: 2009},
        '2010s': {min: 2010, max: 2019},
        '2020s': {min: 2020, max: 2026}
      };
      minYear = Math.min(...activeEras.map(e => yearMap[e].min));
      maxYear = Math.max(...activeEras.map(e => yearMap[e].max));
    }

    const dateFilter = `&primary_release_date.gte=${minYear}-01-01&primary_release_date.lte=${maxYear}-12-31`;

    // 1. Partner 1 prefs (broader pool)
    let url1 = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=popularity.desc${dateFilter}`;
    const activeGenres1 = Object.keys(myPrefs).filter(g => myPrefs[g] > 60);
    if (activeGenres1.length > 0) {
      const genreIds = activeGenres1.map(g => {
        const map: Record<string, number> = { Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80, Drama: 18, Fantasy: 14, Horror: 27, Mystery: 9648, Romance: 10749, SciFi: 878, Thriller: 53, War: 10752, Western: 37 };
        return map[g];
      }).join(',');
      url1 += `&with_genres=${genreIds}`;
    }
    const p1Results = await fetchPages(url1, 4);
    allResults.push(...p1Results);

    // 2. Partner 2 prefs (broader pool)
    let url2 = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=popularity.desc${dateFilter}`;
    const activeGenres2 = Object.keys(partnerPrefs).filter(g => partnerPrefs[g] > 60);
    if (activeGenres2.length > 0) {
      const genreIds = activeGenres2.map(g => {
        const map: Record<string, number> = { Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80, Drama: 18, Fantasy: 14, Horror: 27, Mystery: 9648, Romance: 10749, SciFi: 878, Thriller: 53, War: 10752, Western: 37 };
        return map[g];
      }).join(',');
      url2 += `&with_genres=${genreIds}`;
    }
    const p2Results = await fetchPages(url2, 4);
    allResults.push(...p2Results);

    // 3. Loose merged / popular fallback for variety
    let url3 = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=popularity.desc${dateFilter}`;
    const mergedGenres: Record<string, number> = {};
    Object.keys(myPrefs).forEach(g => {
      mergedGenres[g] = Math.max(myPrefs[g] || 50, partnerPrefs[g] || 50);
    });
    const activeMerged = Object.keys(mergedGenres).filter(g => mergedGenres[g] > 55);
    if (activeMerged.length > 0) {
      const genreIds = activeMerged.map(g => {
        const map: Record<string, number> = { Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80, Drama: 18, Fantasy: 14, Horror: 27, Mystery: 9648, Romance: 10749, SciFi: 878, Thriller: 53, War: 10752, Western: 37 };
        return map[g];
      }).join(',');
      url3 += `&with_genres=${genreIds}`;
    }
    const mergedResults = await fetchPages(url3, 3);
    allResults.push(...mergedResults);

    // Remove duplicates and shuffle heavily for true blend
    const unique = allResults.filter((movie, index, self) =>
      index === self.findIndex(m => m.id === movie.id)
    );
    const shuffled = unique.sort(() => Math.random() - 0.5);

    setMovies(shuffled);
    setCurrentIndex(0);
  };

  useEffect(() => {
    fetchMovies();
  }, [myPrefs, partnerPrefs, myEraPrefs, partnerEraPrefs]);

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
      setCurrentIndex(prev => (prev + 1) % (movies.length || 1));
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
      setCurrentIndex(prev => (prev - 1 + (movies.length || 1)) % (movies.length || 1));
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
      setMyFavoriteActors(prev => [...prev, newActor.trim()]);
      setNewActor('');
    }
  };

  const removeActor = (actor: string) => {
    setMyFavoriteActors(prev => prev.filter(a => a !== actor));
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
        <div className="likes" onClick={() => setCurrentTab('matches')} style={{ cursor: 'pointer' }}>❤️ Matches ({mutualMatches.length})</div>
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
                <div className="overlay" style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: '12px', 
                  right: '12px', 
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', 
                  padding: '16px 16px 14px', 
                  color: 'white', 
                  fontSize: '0.95rem',
                  textAlign: 'center',
                  borderBottomLeftRadius: '24px',
                  borderBottomRightRadius: '24px'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px', lineHeight: 1.2 }}>{currentMovie.title}</div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.95 }}>
                    {currentMovie.release_date?.slice(0, 4) || 'N/A'} • {currentMovie.vote_average?.toFixed(1) || '0'} ★
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
        </div>
      )}

      {currentTab === 'matches' && (
        <div className="matches-page">
          <div className="matches-tabs">
            <button className={matchesSubTab === 'mutual' ? 'active' : ''} onClick={() => setMatchesSubTab('mutual')}>Mutual Matches</button>
            <button className={matchesSubTab === 'my-likes' ? 'active' : ''} onClick={() => setMatchesSubTab('my-likes')}>My Likes</button>
          </div>
          <div className="matches-grid">
            {(matchesSubTab === 'mutual' ? mutualMatches : likedMovies).length > 0 ? (
              (matchesSubTab === 'mutual' ? mutualMatches : likedMovies).map(movie => (
                <div 
                  key={movie.id} 
                  className="match-card"
                  onClick={() => {
                    setDetailMovie(movie);
                    setShowDetails(true);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <img className="match-img" src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} alt={movie.title} />
                  <div className="match-overlay">
                    <div className="match-title">{movie.title}</div>
                    <div className="match-meta">
                      {movie.release_date?.slice(0,4) || 'N/A'} • {movie.vote_average?.toFixed(1) || '0'} ★
                    </div>
                    <div 
                      className="match-details-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDetailMovie(movie);
                        setShowDetails(true);
                      }}
                      style={{ pointerEvents: 'auto', zIndex: 100, position: 'relative' }}
                    >
                      Details
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.7 }}>
                {matchesSubTab === 'mutual' 
                  ? "No mutual matches yet. Both swipe right on the same movie!" 
                  : "No likes yet. Start swiping!"}
              </p>
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

            {/* My Preferences */}
            <div style={{ marginBottom: '2.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>My Preferences</h3>
              {Object.keys(myPrefs).map(genre => (
                <div key={genre} className="slider-row">
                  <label>{genre}</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={myPrefs[genre]} 
                    onChange={e => setMyPrefs(prev => ({...prev, [genre]: Number(e.target.value)}))} 
                  />
                </div>
              ))}
              <div className="actor-input">
                <input value={newActor} onChange={e => setNewActor(e.target.value)} placeholder="Add favorite actor" />
                <button onClick={addActor}>Add</button>
              </div>
              <ul className="actor-list">
                {myFavoriteActors.map(actor => (
                  <li key={actor}>
                    {actor}
                    <button onClick={() => removeActor(actor)}>Remove</button>
                  </li>
                ))}
              </ul>
              <div className="era-grid">
                {Object.keys(myEraPrefs).map(era => (
                  <label key={era} className="era-label">
                    <input type="checkbox" checked={myEraPrefs[era]} onChange={e => setMyEraPrefs(prev => ({...prev, [era]: e.target.checked}))} />
                    {era}
                  </label>
                ))}
              </div>
            </div>

            {/* Partner's Preferences */}
            {coupleCode && (
              <div style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>Partner's Preferences</h3>
                {Object.keys(partnerPrefs).map(genre => (
                  <div key={genre} className="slider-row">
                    <label>{genre}</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={partnerPrefs[genre]} 
                      onChange={e => setPartnerPrefs(prev => ({...prev, [genre]: Number(e.target.value)}))} 
                    />
                  </div>
                ))}
                <div className="actor-input">
                  <input value={newActor} onChange={e => setNewActor(e.target.value)} placeholder="Add favorite actor (for partner)" />
                  <button onClick={addActor}>Add</button>
                </div>
                <ul className="actor-list">
                  {partnerFavoriteActors.map(actor => (
                    <li key={actor}>
                      {actor}
                      <button onClick={() => removeActor(actor)}>Remove</button>
                    </li>
                  ))}
                </ul>
                <div className="era-grid">
                  {Object.keys(partnerEraPrefs).map(era => (
                    <label key={era} className="era-label">
                      <input type="checkbox" checked={partnerEraPrefs[era]} onChange={e => setPartnerEraPrefs(prev => ({...prev, [era]: e.target.checked}))} />
                      {era}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem', padding: '12px', background: '#222', borderRadius: '12px', fontSize: '0.95rem', textAlign: 'center', color: '#22c55e' }}>
              ✅ Merged Deck Active (both partners' preferences combined)
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

      {/* Modal at root level */}
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