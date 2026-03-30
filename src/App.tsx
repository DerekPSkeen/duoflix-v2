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

  // Watch Together - simple version
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinedCode, setJoinedCode] = useState('');
  const [roomStatus, setRoomStatus] = useState('Create or join a room to watch together!');
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

  const onPointer