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

  // Watch Together - minimal
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinedCode, setJoinedCode] = useState('');
  const [roomStatus, setRoomStatus] = useState('Create or join a room to watch together!');
  const [isInRoom, setIsInRoom] = useState(false);

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
  }, []);

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
    setIsFlyingOff(true);
    setFlyDirection(liked ? 'right' : 'left');
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % (movies.length || 1));
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
      setCurrentIndex(prev => (prev - 1 + (movies.length || 1)) % (movies.length || 1));
    }
  };

  const createRoom = () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomCode(newCode);
    setRoomStatus(`Room created! Code: ${newCode}`);
    setIsInRoom(true);
  };

  const joinRoom = () => {
    if (joinedCode.length === 6) {
      setRoomCode(joinedCode);
      setRoomStatus(`Joined room ${joinedCode}`);
      setIsInRoom(true);
    } else {
      setRoomStatus('Please enter a valid 6-digit code');
    }
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
                <p className="modal-meta