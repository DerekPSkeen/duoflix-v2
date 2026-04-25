import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
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
  const [watchProviders, setWatchProviders] = useState<WatchProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'swipe' | 'matches' | 'watch' | 'prefs'>('swipe');

  const [matchesSubTab, setMatchesSubTab] = useState<'mutual' | 'my-likes'>('mutual');

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [coupleCode, setCoupleCode] = useState<string | null>(null);
  const [joinedCode, setJoinedCode] = useState('');
  const [roomStatus, setRoomStatus] = useState('Create or join a room to watch together!');
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);

  const channelRef = useRef<any>(null);
  const prefsSubscriptionRef = useRef<any>(null);
  const likesSubscriptionRef = useRef<any>(null);

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

  const [showLanding, setShowLanding] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isFlyingOff, setIsFlyingOff] = useState(false);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);

  const prevMatchCountRef = useRef(0);

  const currentMovie = movies[currentIndex];

  const playMatchSound = () => {
    try {
      const sound = new Audio("https://assets.mixkit.co/sfx/preview/296/296-preview.mp3");
      sound.volume = 0.65;
      sound.play().catch(() => {});
    } catch (e) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.35;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => osc.stop(), 160);
      } catch {}
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const autoJoinPermanentRoom = async () => {
      if (!user?.id || !coupleCode) return;
      
      setRoomCode(coupleCode);
      setIsInRoom(true);
      setRoomStatus(`Joined permanent room ${coupleCode}`);
      setChatMessages([`Welcome back to your permanent room ${coupleCode}`]);
    };

    autoJoinPermanentRoom();
  }, [user, coupleCode]);

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

  useEffect(() => {
    if (!coupleCode) return;

    const loadPrefs = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const { data, error } = await supabase
        .from('couple_preferences')
        .select('preferences')
        .eq('couple_code', coupleCode)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load preferences:', error);
        return;
      }

      if (data?.preferences) {
        const prefs = data.preferences;
        if (prefs.myPrefs) setMyPrefs(prefs.myPrefs);
        if (prefs.partnerPrefs) setPartnerPrefs(prefs.partnerPrefs);
        if (prefs.myEraPrefs) setMyEraPrefs(prefs.myEraPrefs);
        if (prefs.partnerEraPrefs) setPartnerEraPrefs(prefs.partnerEraPrefs);
        if (prefs.myFavoriteActors) setMyFavoriteActors(prefs.myFavoriteActors);
        if (prefs.partnerFavoriteActors) setPartnerFavoriteActors(prefs.partnerFavoriteActors);
      }
    };

    loadPrefs();

    const subscription = supabase
      .channel(`prefs-${coupleCode}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'couple_preferences', filter: `couple_code=eq.${coupleCode}` }, 
        (payload) => {
          if (payload.new?.preferences) {
            const prefs = payload.new.preferences;
            if (prefs.myPrefs) setMyPrefs(prefs.myPrefs);
            if (prefs.partnerPrefs) setPartnerPrefs(prefs.partnerPrefs);
            if (prefs.myEraPrefs) setMyEraPrefs(prefs.myEraPrefs);
            if (prefs.partnerEraPrefs) setPartnerEraPrefs(prefs.partnerEraPrefs);
            if (prefs.myFavoriteActors) setMyFavoriteActors(prefs.myFavoriteActors);
            if (prefs.partnerFavoriteActors) setPartnerFavoriteActors(prefs.partnerFavoriteActors);
          }
        }
      )
      .subscribe();

    prefsSubscriptionRef.current = subscription;

    return () => {
      if (prefsSubscriptionRef.current) {
        supabase.removeChannel(prefsSubscriptionRef.current);
      }
    };
  }, [coupleCode]);

  const savePreferences = async () => {
    if (!coupleCode) {
      alert('Please create or join a room first to save preferences.');
      return;
    }

    const preferencesData = {
      myPrefs,
      partnerPrefs,
      myEraPrefs,
      partnerEraPrefs,
      myFavoriteActors,
      partnerFavoriteActors
    };

    const { error } = await supabase
      .from('couple_preferences')
      .upsert({
        couple_code: coupleCode,
        preferences: preferencesData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'couple_code' });

    if (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } else {
      alert('Preferences saved successfully!');
    }
  };

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

    channel.on('broadcast', { event: 'like' }, () => {
      setTimeout(() => loadPersistentLikes(), 300);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [isInRoom, roomCode]);

  useEffect(() => {
    const mutual = likedMovies.filter(my => 
      sharedLikes.some(partner => partner.id === my.id)
    );
    
    const newCount = mutual.length;
    
    if (newCount > prevMatchCountRef.current) {
      playMatchSound();
    }
    
    setMutualMatches(mutual);
    prevMatchCountRef.current = newCount;
  }, [likedMovies, sharedLikes]);

  const loadPersistentLikes = async () => {
    if (!coupleCode) return;

    const { data, error } = await supabase
      .from('couple_likes')
      .select('movie_data, user_id')
      .eq('couple_code', coupleCode);

    if (error) {
      console.error('Failed to load persistent likes:', error);
      return;
    }

    if (data && data.length > 0) {
      const allLoaded = data;

      const isMyLike = (item: any) => {
        const likerId = item.user_id;
        if (user?.id) {
          return likerId === user.id;
        } else {
          return likerId === null || likerId === undefined;
        }
      };

      const myMovies: Movie[] = allLoaded
        .filter(isMyLike)
        .map((item: any) => item.movie_data as Movie);

      const partnerMovies: Movie[] = allLoaded
        .filter((item: any) => !isMyLike(item))
        .map((item: any) => item.movie_data as Movie);

      setLikedMovies(myMovies);
      setSharedLikes(partnerMovies);
    } else {
      setLikedMovies([]);
      setSharedLikes([]);
    }
  };

  useEffect(() => {
    loadPersistentLikes();
  }, [coupleCode, user]);

  useEffect(() => {
    if (!coupleCode) return;

    const subscription = supabase
      .channel(`likes-${coupleCode}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'couple_likes', filter: `couple_code=eq.${coupleCode}` }, 
        () => {
          setTimeout(() => loadPersistentLikes(), 200);
        }
      )
      .subscribe();

    likesSubscriptionRef.current = subscription;

    return () => {
      if (likesSubscriptionRef.current) {
        supabase.removeChannel(likesSubscriptionRef.current);
      }
    };
  }, [coupleCode, user]);

  const clearAllLikesAndMatches = async () => {
    if (!coupleCode) {
      alert('No couple code found. Join or create a room first.');
      return;
    }

    if (!window.confirm('⚠️ This will permanently delete ALL likes and matches for BOTH users. This action cannot be undone. Continue?')) {
      return;
    }

    const { error } = await supabase
      .from('couple_likes')
      .delete()
      .eq('couple_code', coupleCode);

    if (error) {
      console.error('Failed to clear likes from database:', error);
      alert('Failed to clear data from server. Please try again.');
      return;
    }

    setLikedMovies([]);
    setSharedLikes([]);
    setMutualMatches([]);
    setLastLiked(null);

    alert('All likes and matches have been cleared for both users.');
    setTimeout(() => loadPersistentLikes(), 300);
  };

  const clearMyLikesOnly = async () => {
    if (!coupleCode) {
      alert('No couple code found.');
      return;
    }

    const confirmText = user?.id 
      ? '⚠️ This will permanently delete ONLY YOUR likes. Your partner’s likes will stay. Continue?'
      : '⚠️ This will permanently delete ONLY YOUR (guest) likes. Your partner’s likes will stay. Continue?';

    if (!window.confirm(confirmText)) return;

    let query = supabase
      .from('couple_likes')
      .delete()
      .eq('couple_code', coupleCode);

    if (user?.id) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { error } = await query;

    if (error) {
      console.error('Failed to clear my likes:', error);
      alert('Failed to clear your likes. Please try again. Error: ' + (error.message || 'Unknown error'));
      return;
    }

    setLikedMovies([]);
    setMutualMatches([]);
    setLastLiked(null);

    alert('Only your likes have been cleared. Your partner’s likes remain.');
    setTimeout(() => loadPersistentLikes(), 300);
  };

  const fetchMovies = async () => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    if (!apiKey) return;

    const genreList = Object.keys(myPrefs);
    const combined: Record<string, number> = {};
    let totalScore = 0;

    genreList.forEach(g => {
      const score = (myPrefs[g] || 0) + (partnerPrefs[g] || 0);
      combined[g] = score;
      totalScore += score;
    });

    const targetTotal = 150;
    const targets: Record<string, number> = {};
    genreList.forEach(g => {
      if (combined[g] > 0) {
        const percent = combined[g] / totalScore;
        targets[g] = Math.max(8, Math.round(targetTotal * percent));
      }
    });

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

    const allResults: Movie[] = [];
    const genreIdMap: Record<string, number> = { Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80, Drama: 18, Fantasy: 14, Horror: 27, Mystery: 9648, Romance: 10749, SciFi: 878, Thriller: 53, War: 10752, Western: 37 };

    for (const [genre, count] of Object.entries(targets)) {
      const genreId = genreIdMap[genre];
      if (!genreId) continue;

      const baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=popularity.desc&with_genres=${genreId}${dateFilter}`;

      let fetched = 0;
      let page = 1;
      while (fetched < count && page <= 8) {
        try {
          const res = await fetch(`${baseUrl}&page=${page}`);
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            allResults.push(...data.results);
            fetched += data.results.length;
          } else break;
          page++;
        } catch (e) {
          break;
        }
      }
    }

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

  const fetchWatchProviders = async (movieId: number) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    if (!apiKey) return;
    setProvidersLoading(true);
    setWatchProviders([]);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${apiKey}`);
      const data = await res.json();
      const usProviders = data.results?.US || {};
      const allProviders: WatchProvider[] = [];
      
      if (usProviders.flatrate) {
        allProviders.push(...usProviders.flatrate.map((p: any) => ({
          provider_id: p.provider_id,
          provider_name: p.provider_name,
          logo_path: p.logo_path
        })));
      }
      if (usProviders.rent) {
        allProviders.push(...usProviders.rent.map((p: any) => ({
          provider_id: p.provider_id,
          provider_name: p.provider_name,
          logo_path: p.logo_path
        })));
      }
      if (usProviders.buy) {
        allProviders.push(...usProviders.buy.map((p: any) => ({
          provider_id: p.provider_id,
          provider_name: p.provider_name,
          logo_path: p.logo_path
        })));
      }

      const uniqueProviders = Array.from(new Map(allProviders.map(p => [p.provider_id, p])).values());
      setWatchProviders(uniqueProviders.slice(0, 8));
    } catch (e) {
      console.error('Failed to fetch watch providers:', e);
    } finally {
      setProvidersLoading(false);
    }
  };

  useEffect(() => {
    if (showDetails && detailMovie) {
      fetchActors(detailMovie.id);
      fetchWatchProviders(detailMovie.id);
    } else {
      setWatchProviders([]);
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
              movie_data: currentMovie,
              user_id: user?.id ?? null
            }, { onConflict: 'couple_code,movie_id,user_id' })
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
      setShowLanding(false);
    } catch (err) {
      alert('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSwipingFree = useCallback(() => {
    setShowLanding(false);
    setShowAuthModal(false);
  }, []);

  const handleSignIn = useCallback(() => {
    setShowAuthModal(true);
    setAuthMode('login');
  }, []);

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
    setEmail('');
    setPassword('');
  }, []);

  const openPrivacyModal = useCallback(() => setShowPrivacyModal(true), []);
  const closePrivacyModal = useCallback(() => setShowPrivacyModal(false), []);
  const openTermsModal = useCallback(() => setShowTermsModal(true), []);
  const closeTermsModal = useCallback(() => setShowTermsModal(false), []);

  return (
    <>
      {/* LANDING PAGE - Polished hero text only */}
      {showLanding && (
        <div className="landing-page" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, #111 0%, #000 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '16px',
          WebkitTextSizeAdjust: 'none',
          textSizeAdjust: 'none',
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 9999,
          width: '100%',
          height: '100dvh',
          display: 'block',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)'
        }}>
          <div style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '40px 20px 80px',
            position: 'relative'
          }}>
            <div style={{ 
              fontSize: 'clamp(1.9rem, 6.5vw, 2.7rem)', 
              lineHeight: 1.05, 
              fontWeight: 700, 
              letterSpacing: '-0.04em', 
              maxWidth: '400px', 
              marginBottom: '24px' 
            }}>
              Stop arguing over what to watch.
            </div>
            <div style={{ 
              fontSize: 'clamp(1.0rem, 4vw, 1.2rem)', 
              opacity: 0.9, 
              maxWidth: '360px', 
              marginBottom: '48px',
              lineHeight: 1.5
            }}>
              Swipe together. Match instantly.<br />
              Share one private room forever.
            </div>

            <button 
              onClick={handleStartSwipingFree}
              style={{
                background: '#ef4444',
                color: 'white',
                fontWeight: 600,
                fontSize: 'clamp(1.1rem, 4.2vw, 1.25rem)',
                padding: '18px 52px',
                borderRadius: '9999px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                marginBottom: '20px',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '320px'
              }}
            >
              Start Swiping Free
            </button>

            <button 
              onClick={handleSignIn}
              style={{
                background: 'transparent',
                color: 'white',
                border: '2px solid rgba(255,255,255,0.8)',
                padding: '14px 36px',
                borderRadius: '9999px',
                fontSize: 'clamp(0.98rem, 3.9vw, 1.08rem)',
                fontWeight: 600,
                marginBottom: '40px',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '320px'
              }}
            >
              Sign In
            </button>

            <div style={{ fontSize: 'clamp(0.92rem, 3.6vw, 0.98rem)', opacity: 0.78 }}>
              50 titles to try • No account needed • Permanent couple code
            </div>
          </div>

          {/* How It Works Section - unchanged */}
          <div style={{ padding: '60px 20px 100px', background: '#0a0a0a' }}>
            <div style={{ textAlign: 'center', marginBottom: '50px' }}>
              <h2 style={{ fontSize: 'clamp(1.6rem, 5.4vw, 1.9rem)', fontWeight: 700, marginBottom: '12px' }}>How DuoFlix Works</h2>
              <p style={{ fontSize: 'clamp(0.98rem, 3.9vw, 1.1rem)', opacity: 0.88, maxWidth: '420px', margin: '0 auto' }}>
                Four simple steps to better movie nights with your partner
              </p>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
              gap: '24px',
              maxWidth: '1100px',
              margin: '0 auto'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(2.2rem, 6.8vw, 2.8rem)', marginBottom: '14px' }}>🔑</div>
                <h3 style={{ fontSize: 'clamp(1.12rem, 4.4vw, 1.28rem)', marginBottom: '10px' }}>1. Create or Join a Room</h3>
                <p style={{ opacity: 0.88, fontSize: 'clamp(0.94rem, 3.7vw, 1rem)', lineHeight: 1.5 }}>One 6-digit code connects you both instantly in your private couple space.</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(2.2rem, 6.8vw, 2.8rem)', marginBottom: '14px' }}>🎛️</div>
                <h3 style={{ fontSize: 'clamp(1.12rem, 4.4vw, 1.28rem)', marginBottom: '10px' }}>2. Set Your Preferences</h3>
                <p style={{ opacity: 0.88, fontSize: 'clamp(0.94rem, 3.7vw, 1rem)', lineHeight: 1.5 }}>You each adjust genres, eras, and favorite actors. We blend them proportionally.</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(2.2rem, 6.8vw, 2.8rem)', marginBottom: '14px' }}>👆</div>
                <h3 style={{ fontSize: 'clamp(1.12rem, 4.4vw, 1.28rem)', marginBottom: '10px' }}>3. Swipe Together</h3>
                <p style={{ opacity: 0.88, fontSize: 'clamp(0.94rem, 3.7vw, 1rem)', lineHeight: 1.5 }}>Tinder-style swiping on real movies and TV shows. The deck intelligently mixes both your tastes.</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(2.2rem, 6.8vw, 2.8rem)', marginBottom: '14px' }}>❤️</div>
                <h3 style={{ fontSize: 'clamp(1.12rem, 4.4vw, 1.28rem)', marginBottom: '10px' }}>4. Get Matches &amp; Watch</h3>
                <p style={{ opacity: 0.88, fontSize: 'clamp(0.94rem, 3.7vw, 1rem)', lineHeight: 1.5 }}>See mutual matches. Jump into a shared watch room with realtime chat. Press play.</p>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '70px' }}>
              <button 
                onClick={handleStartSwipingFree}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 'clamp(1.05rem, 4.1vw, 1.22rem)',
                  padding: '16px 48px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  maxWidth: '300px'
                }}
              >
                Ready? Start Swiping Free Now
              </button>
            </div>
          </div>

          {/* Pricing Section - unchanged */}
          <div style={{ padding: '60px 20px 100px', background: '#111' }}>
            <div style={{ textAlign: 'center', marginBottom: '50px' }}>
              <h2 style={{ fontSize: 'clamp(1.6rem, 5.4vw, 1.9rem)', fontWeight: 700, marginBottom: '16px' }}>Simple Pricing</h2>
              <p style={{ fontSize: 'clamp(0.98rem, 3.9vw, 1.1rem)', opacity: 0.88, maxWidth: '420px', margin: '0 auto' }}>
                Start free. Upgrade when you want unlimited swipes and full couple features.
              </p>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', 
              gap: '24px',
              maxWidth: '1100px',
              margin: '0 auto'
            }}>
              <div style={{ 
                background: '#1a1a1a', 
                borderRadius: '20px', 
                padding: '28px', 
                textAlign: 'center',
                border: '1px solid #333'
              }}>
                <h3 style={{ fontSize: 'clamp(1.2rem, 4.5vw, 1.4rem)', marginBottom: '8px' }}>Free</h3>
                <div style={{ fontSize: 'clamp(1.9rem, 6vw, 2.5rem)', fontWeight: 700, marginBottom: '6px' }}>0</div>
                <p style={{ opacity: 0.8, marginBottom: '20px' }}>$ / month</p>
                <ul style={{ textAlign: 'left', marginBottom: '28px', opacity: 0.9, fontSize: 'clamp(0.94rem, 3.7vw, 1rem)' }}>
                  <li style={{ marginBottom: '10px' }}>✅ 50 swipes to try the blend</li>
                  <li style={{ marginBottom: '10px' }}>✅ Basic matching</li>
                  <li style={{ marginBottom: '10px' }}>❌ Unlimited swipes</li>
                </ul>
                <button 
                  onClick={handleStartSwipingFree}
                  style={{
                    width: '100%',
                    background: '#444',
                    color: 'white',
                    padding: '13px',
                    borderRadius: '9999px',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 'clamp(1rem, 4vw, 1.08rem)'
                  }}
                >
                  Try Free
                </button>
              </div>

              <div style={{ 
                background: '#1a1a1a', 
                borderRadius: '20px', 
                padding: '28px', 
                textAlign: 'center',
                border: '2px solid #ef4444',
                position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: '-12px', right: '20px', background: '#ef4444', color: 'white', padding: '4px 14px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>Popular</div>
                <h3 style={{ fontSize: 'clamp(1.2rem, 4.5vw, 1.4rem)', marginBottom: '8px' }}>Monthly</h3>
                <div style={{ fontSize: 'clamp(1.9rem, 6vw, 2.5rem)', fontWeight: 700, marginBottom: '6px' }}>$3.99</div>
                <p style={{ opacity: 0.8, marginBottom: '20px' }}>/ month</p>
                <ul style={{ textAlign: 'left', marginBottom: '28px', opacity: 0.9, fontSize: 'clamp(0.94rem, 3.7vw, 1rem)' }}>
                  <li style={{ marginBottom: '10px' }}>✅ Unlimited swipes</li>
                  <li style={{ marginBottom: '10px' }}>✅ Full smart blend</li>
                  <li style={{ marginBottom: '10px' }}>✅ Shared watch room + chat</li>
                  <li style={{ marginBottom: '10px' }}>✅ Mutual matches forever</li>
                </ul>
                <button 
                  style={{
                    width: '100%',
                    background: '#ef4444',
                    color: 'white',
                    padding: '13px',
                    borderRadius: '9999px',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 'clamp(1rem, 4vw, 1.08rem)'
                  }}
                >
                  Subscribe Monthly
                </button>
              </div>

              <div style={{ 
                background: '#1a1a1a', 
                borderRadius: '20px', 
                padding: '28px', 
                textAlign: 'center',
                border: '1px solid #333'
              }}>
                <h3 style={{ fontSize: 'clamp(1.2rem, 4.5vw, 1.4rem)', marginBottom: '8px' }}>Yearly</h3>
                <div style={{ fontSize: 'clamp(1.9rem, 6vw, 2.5rem)', fontWeight: 700, marginBottom: '8px' }}>$39</div>
                <p style={{ opacity: 0.8, marginBottom: '8px' }}>/ year</p>
                <p style={{ fontSize: 'clamp(0.85rem, 3.5vw, 0.92rem)', color: '#22c55e', marginBottom: '24px' }}>(save ~18% • $3.25/mo)</p>
                <ul style={{ textAlign: 'left', marginBottom: '28px', opacity: 0.9, fontSize: 'clamp(0.94rem, 3.7vw, 1rem)' }}>
                  <li style={{ marginBottom: '10px' }}>✅ Everything in Monthly</li>
                  <li style={{ marginBottom: '10px' }}>✅ Best value for couples</li>
                </ul>
                <button 
                  style={{
                    width: '100%',
                    background: '#444',
                    color: 'white',
                    padding: '13px',
                    borderRadius: '9999px',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 'clamp(1rem, 4vw, 1.08rem)'
                  }}
                >
                  Subscribe Yearly
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.8, fontSize: 'clamp(0.9rem, 3.5vw, 0.95rem)' }}>
              Cancel anytime • No ads • Your couple code stays forever
            </div>
          </div>

          {/* Footer with legal links - unchanged */}
          <div style={{
            padding: '40px 20px 60px',
            background: '#0a0a0a',
            textAlign: 'center',
            fontSize: 'clamp(0.82rem, 3.2vw, 0.9rem)',
            opacity: 0.75,
            borderTop: '1px solid #222'
          }}>
            <div>© 2026 DuoFlix • Made for couples who love movies</div>
            <div style={{ marginTop: '12px' }}>
              <span 
                onClick={openPrivacyModal}
                style={{ color: 'inherit', textDecoration: 'none', marginRight: '16px', cursor: 'pointer' }}
              >
                Privacy Policy
              </span>
              <span 
                onClick={openTermsModal}
                style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
              >
                Terms of Service
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MAIN APP - completely unchanged, including the tab label change only in navigation */}
      {!showLanding && (
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
            <div className="likes" onClick={() => setCurrentTab('matches')} style={{ cursor: 'pointer' }}>
              ❤️ Matches ({mutualMatches.length})
            </div>
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

                <button 
                  onClick={clearMyLikesOnly}
                  style={{
                    width: '100%',
                    marginTop: '1rem',
                    padding: '1rem',
                    background: '#444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '999px',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🧹 Clear Only My Likes
                </button>

                <button 
                  onClick={clearAllLikesAndMatches}
                  style={{
                    width: '100%',
                    marginTop: '0.75rem',
                    padding: '1rem',
                    background: '#991b1b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '999px',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Clear All Likes & Matches (both users)
                </button>
              </div>
            </div>
          )}

          <nav className="tab-bar">
            <button onClick={() => setCurrentTab('swipe')}>Swipe</button>
            <button onClick={() => setCurrentTab('matches')}>Matches</button>
            <button onClick={() => setCurrentTab('watch')}>Room</button>
            <button onClick={() => setCurrentTab('prefs')}>Prefs</button>
          </nav>

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

                <div style={{ marginTop: '2rem', borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Where to Watch</h3>
                  {providersLoading ? (
                    <p style={{ opacity: 0.7 }}>Loading providers...</p>
                  ) : watchProviders.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-start' }}>
                      {watchProviders.map(provider => (
                        <div key={provider.provider_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '70px', textAlign: 'center' }}>
                          {provider.logo_path ? (
                            <img src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt={provider.provider_name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain', background: '#222', padding: '4px' }} />
                          ) : (
                            <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                              {provider.provider_name.slice(0, 2)}
                            </div>
                          )}
                          <div style={{ fontSize: '0.75rem', marginTop: '6px', opacity: 0.85, maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {provider.provider_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ opacity: 0.7 }}>No streaming providers found for this movie in your region at this time.</p>
                  )}
                  <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '1rem' }}>
                    Data from TMDB / JustWatch • Availability may vary by region
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AUTH MODAL - unchanged */}
      {showAuthModal && createPortal(
        <div 
          className="modal-overlay auth-modal-portal" 
          onClick={closeAuthModal}
        >
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()}
          >
            <button 
              className="close-btn" 
              onClick={closeAuthModal} 
            >
              ×
            </button>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#fff' }}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              style={{ width: '100%', padding: '12px', marginBottom: '12px', background: '#222', border: '1px solid #444', borderRadius: '8px', color: 'white' }} 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ width: '100%', padding: '12px', marginBottom: '20px', background: '#222', border: '1px solid #444', borderRadius: '8px', color: 'white' }} 
            />
            <button 
              onClick={handleAuth} 
              disabled={isLoading} 
              style={{ 
                width: '100%', 
                padding: '14px', 
                background: '#22c55e', 
                color: '#000', 
                border: 'none', 
                borderRadius: '999px', 
                fontWeight: 600 
              }}
            >
              {isLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem', color: '#ccc' }}>
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <span 
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} 
                style={{ color: '#3b82f6', cursor: 'pointer' }}
              >
                {authMode === 'login' ? 'Sign up' : 'Sign in'}
              </span>
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* Privacy Policy Modal - unchanged */}
      {showPrivacyModal && createPortal(
        <div 
          className="modal-overlay" 
          onClick={closePrivacyModal}
          style={{ zIndex: 10000002 }}
        >
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <button className="close-btn" onClick={closePrivacyModal}>×</button>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>Privacy Policy</h2>
            <div style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>
              <p><strong>Last updated:</strong> April 23, 2026</p>
              <p>At DuoFlix, we respect your privacy and are committed to protecting it. This Privacy Policy explains how we collect, use, and safeguard your information when you use our service.</p>
              
              <h3>Information We Collect</h3>
              <p>We collect only the information necessary to provide the DuoFlix service:</p>
              <ul>
                <li><strong>Account Information</strong>: If you choose to sign in, we collect your email address (via Supabase authentication).</li>
                <li><strong>Couple Data</strong>: Your couple code, shared preferences (genres, eras, favorite actors), and liked movies/TV shows.</li>
                <li><strong>Usage Data</strong>: Anonymous information about how the app is used to help us improve the experience.</li>
              </ul>
              <p>We do not collect names, phone numbers, location data, or any unnecessary personal details.</p>

              <h3>How We Use Your Information</h3>
              <p>We use the information solely to create and manage your private couple space, generate personalized recommendations, enable realtime chat and shared watching, and improve the app.</p>

              <h3>Information We Do Not Share</h3>
              <p><strong>We do not sell, rent, trade, or otherwise share any personal information or user-generated data with any third parties for marketing or advertising purposes.</strong></p>
              <p>The only external services we use are Supabase (to securely store and sync your couple’s private data) and TMDB (public movie/TV metadata only — no user data is ever sent to TMDB).</p>
              <p>We may later use privacy-friendly analytics tools to understand how the app is used. These tools collect minimal, anonymized usage data and do not track you across other websites.</p>

              <h3>Your Rights</h3>
              <p>You can delete all your data at any time using the “Clear All Likes &amp; Matches” feature or by emailing support@duoflix.com.</p>

              <h3>Contact Us</h3>
              <p>If you have any questions, please contact us at support@duoflix.com.</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Terms of Service Modal - unchanged */}
      {showTermsModal && createPortal(
        <div 
          className="modal-overlay" 
          onClick={closeTermsModal}
          style={{ zIndex: 10000002 }}
        >
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <button className="close-btn" onClick={closeTermsModal}>×</button>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>Terms and Conditions</h2>
            <div style={{ lineHeight: 1.6, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
              Terms and Conditions
====================

Last updated: April 23, 2026

Please read these terms and conditions carefully before using Our Service.

Interpretation and Definitions  
------------------------------

Interpretation  
~~~~~~~~~~~~~~

The words whose initial letters are capitalized have meanings defined under
the following conditions. The following definitions shall have the same
meaning regardless of whether they appear in singular or in plural.

Definitions  
~~~~~~~~~~~

For the purposes of these Terms and Conditions:

  * Affiliate means an entity that controls, is controlled by, or is under
    common control with a party, where "control" means ownership of 50% or
    more of the shares, equity interest or other securities entitled to vote
    for election of directors or other managing authority.

  * Country refers to: Wisconsin, United States

  * Company (referred to as either "the Company", "We", "Us" or "Our" in these
    Terms and Conditions) refers to DuoFlix.

  * Device means any device that can access the Service such as a computer, a
    cell phone or a digital tablet.

  * Service refers to the Website.

  * Terms and Conditions (also referred to as "Terms") means these Terms and
    Conditions, including any documents expressly incorporated by reference,
    which govern Your access to and use of the Service and form the entire
    agreement between You and the Company regarding the Service. These Terms
    and Conditions have been created with the help of the [Terms and
    Conditions Generator](https://www.termsfeed.com/terms-conditions-
    generator/).

  * Third-Party Social Media Service means any services or content (including
    data, information, products or services) provided by a third party that is
    displayed, included, made available, or linked to through the Service.

  * Website refers to DuoFlix, accessible from
    [duoflix-v2.vercel.app](duoflix-v2.vercel.app)

  * You means the individual accessing or using the Service, or the company,
    or other legal entity on behalf of which such individual is accessing or
    using the Service, as applicable.


Acknowledgment  
--------------

These are the Terms and Conditions governing the use of this Service and the
agreement between You and the Company. These Terms and Conditions set out the
rights and obligations of all users regarding the use of the Service.

Your access to and use of the Service is conditioned on Your acceptance of and
compliance with these Terms and Conditions. These Terms and Conditions apply
to all visitors, users and others who access or use the Service.

By accessing or using the Service You agree to be bound by these Terms and
Conditions. If You disagree with any part of these Terms and Conditions then
You may not access the Service.

You represent that you are over the age of 18. The Company does not permit
those under 18 to use the Service.

Your access to and use of the Service is also subject to Our Privacy Policy,
which describes how We collect, use, and disclose personal information. Please
read Our Privacy Policy carefully before using Our Service.

Links to Other Websites  
-----------------------

Our Service may contain links to third-party websites or services that are not
owned or controlled by the Company.

The Company has no control over, and assumes no responsibility for, the
content, privacy policies, or practices of any third-party websites or
services. You further acknowledge and agree that the Company shall not be
responsible or liable, directly or indirectly, for any damage or loss caused
or alleged to be caused by or in connection with the use of or reliance on any
such content, goods or services available on or through any such websites or
services.

We strongly advise You to read the terms and conditions and privacy policies
of any third-party websites or services that You visit.

Links from a Third-Party Social Media Service  
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The Service may display, include, make available, or link to content or
services provided by a Third-Party Social Media Service. A Third-Party Social
Media Service is not owned or controlled by the Company, and the Company does
not endorse or assume responsibility for any Third-Party Social Media Service.

You acknowledge and agree that the Company shall not be responsible or liable,
directly or indirectly, for any damage or loss caused or alleged to be caused
by or in connection with Your access to or use of any Third-Party Social Media
Service, including any content, goods, or services made available through
them. Your use of any Third-Party Social Media Service is governed by that
Third-Party Social Media Service's terms and privacy policies.

Termination  
-----------

We may terminate or suspend Your access immediately, without prior notice or
liability, for any reason whatsoever, including without limitation if You
breach these Terms and Conditions.

Upon termination, Your right to use the Service will cease immediately.

Limitation of Liability  
-----------------------

Notwithstanding any damages that You might incur, the entire liability of the
Company and any of its suppliers under any provision of these Terms and Your
exclusive remedy for all of the foregoing shall be limited to the amount
actually paid by You through the Service or 100 USD if You haven't purchased
anything through the Service.

To the maximum extent permitted by applicable law, in no event shall the
Company or its suppliers be liable for any special, incidental, indirect, or
consequential damages whatsoever (including, but not limited to, damages for
loss of profits, loss of data or other information, for business interruption,
for personal injury, loss of privacy arising out of or in any way related to
the use of or inability to use the Service, third-party software and/or third-
party hardware used with the Service, or otherwise in connection with any
provision of these Terms), even if the Company or any supplier has been
advised of the possibility of such damages and even if the remedy fails of its
essential purpose.

Some states do not allow the exclusion of implied warranties or limitation of
liability for incidental or consequential damages, which means that some of
the above limitations may not apply. In these states, each party's liability
will be limited to the greatest extent permitted by law.

"AS IS" and "AS AVAILABLE" Disclaimer  
-------------------------------------

The Service is provided to You "AS IS" and "AS AVAILABLE" and with all faults
and defects without warranty of any kind. To the maximum extent permitted
under applicable law, the Company, on its own behalf and on behalf of its
Affiliates and its and their respective licensors and service providers,
expressly disclaims all warranties, whether express, implied, statutory or
otherwise, with respect to the Service, including all implied warranties of
merchantability, fitness for a particular purpose, title and non-infringement,
and warranties that may arise out of course of dealing, course of performance,
usage or trade practice. Without limitation to the foregoing, the Company
provides no warranty or undertaking, and makes no representation of any kind
that the Service will meet Your requirements, achieve any intended results, be
compatible or work with any other software, applications, systems or services,
operate without interruption, meet any performance or reliability standards or
be error free or that any errors or defects can or will be corrected.

Without limiting the foregoing, neither the Company nor any of the company's
provider makes any representation or warranty of any kind, express or implied:
(i) as to the operation or availability of the Service, or the information,
content, and materials or products included thereon; (ii) that the Service
will be uninterrupted or error-free; (iii) as to the accuracy, reliability, or
currency of any information or content provided through the Service; or (iv)
that the Service, its servers, the content, or e-mails sent from or on behalf
of the Company are free of viruses, scripts, trojan horses, worms, malware,
timebombs or other harmful components.

Some jurisdictions do not allow the exclusion of certain types of warranties
or limitations on applicable statutory rights of a consumer, so some or all of
the above exclusions and limitations may not apply to You. But in such a case
the exclusions and limitations set forth in this section shall be applied to
the greatest extent enforceable under applicable law.

Governing Law  
-------------

The laws of the Country, excluding its conflicts of law rules, shall govern
these Terms and Your use of the Service. Your use of the Application may also
be subject to other local, state, national, or international laws.

Disputes Resolution  
-------------------

If You have any concern or dispute about the Service, You agree to first try
to resolve the dispute informally by contacting the Company.

For European Union (EU) Users  
-----------------------------

If You are a European Union consumer, you will benefit from any mandatory
provisions of the law of the country in which You are resident.

United States Legal Compliance  
------------------------------

You represent and warrant that (i) You are not located in a country that is
subject to the United States government embargo, or that has been designated
by the United States government as a "terrorist supporting" country, and (ii)
You are not listed on any United States government list of prohibited or
restricted parties.

Severability and Waiver  
-----------------------

Severability  
~~~~~~~~~~~~

If any provision of these Terms is held to be unenforceable or invalid, such
provision will be changed and interpreted to accomplish the objectives of such
provision to the greatest extent possible under applicable law and the
remaining provisions will continue in full force and effect.

Waiver  
~~~~~~

Except as provided herein, the failure to exercise a right or to require
performance of an obligation under these Terms shall not affect a party's
ability to exercise such right or require such performance at any time
thereafter nor shall the waiver of a breach constitute a waiver of any
subsequent breach.

Translation Interpretation  
--------------------------

These Terms and Conditions may have been translated if We have made them
available to You on our Service. You agree that the original English text
shall prevail in the case of a dispute.

Changes to These Terms and Conditions  
-------------------------------------

We reserve the right, at Our sole discretion, to modify or replace these Terms
at any time. If a revision is material We will make reasonable efforts to
provide at least 30 days' notice prior to any new terms taking effect. What
constitutes a material change will be determined at Our sole discretion.

By continuing to access or use Our Service after those revisions become
effective, You agree to be bound by the revised terms. If You do not agree to
the new terms, in whole or in part, please stop using the Service.

Contact Us  
----------

If you have any questions about these Terms and Conditions, You can contact
us:

  * By email: support@duoflix.com
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default App;