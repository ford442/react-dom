import React, { useState, useEffect, useRef, useCallback } from 'react';

// Helper function to load a script dynamically
const loadScript = (src) => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};


// Main App Component
export default function App() {
  const [sdkLoaded, setSdkLoaded] = useState(false);

  useEffect(() => {
    // This effect loads the Spotify Web Playback SDK.
    // It's structured to avoid race conditions.

    // If the SDK is already loaded (e.g., from a previous navigation), we're done.
    if (window.Spotify) {
      setSdkLoaded(true);
      return;
    }

    // Set the callback function that the Spotify SDK will call when it's ready.
    // This MUST be defined before the script is loaded.
    window.onSpotifyWebPlaybackSDKReady = () => {
      setSdkLoaded(true);
    };

    // Now, load the script. The script, once loaded, will see the callback and execute it.
    loadScript('https://sdk.scdn.co/spotify-player.js').then(loaded => {
        if (!loaded) {
            console.error("Failed to load Spotify SDK");
        }
    });

    // Cleanup function to avoid memory leaks if the component unmounts.
    return () => {
      window.onSpotifyWebPlaybackSDKReady = null;
    };
  }, []); // Empty dependency array ensures this runs only once on mount.

  // We only render the visualizer component once the SDK is ready
  return (
    <div className="bg-spotify-dark text-white antialiased">
      {sdkLoaded ? <SpotifyVisualizer /> : <LoadingScreen />}
    </div>
  );
}

// A simple loading component
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-4">
    <h1 className="text-4xl font-bold tracking-tight">Loading Spotify SDK...</h1>
  </div>
);


// The main Visualizer Component
const SpotifyVisualizer = () => {
    // Refs for DOM elements that don't need to re-render the component
    const canvasRef = useRef(null);
    const searchInputRef = useRef(null);
    const animationFrameId = useRef(null);
    const notificationTimeout = useRef(null);

    // State for managing credentials and UI visibility
    const [credentials, setCredentials] = useState({ clientId: '', clientSecret: '', oauthToken: '' });
    const [showCredentialsModal, setShowCredentialsModal] = useState(true);
    const [credentialError, setCredentialError] = useState('');
    const [notification, setNotification] = useState('');

    // State for Spotify API and player
    const [spotifyApiToken, setSpotifyApiToken] = useState(null);
    const [spotifyPlayer, setSpotifyPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [audioAnalysis, setAudioAnalysis] = useState(null);
    const [playbackState, setPlaybackState] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // --- Handlers for input changes ---
    const handleCredentialChange = (e) => {
        const { id, value } = e.target;
        setCredentials(prev => ({ ...prev, [id]: value }));
    };

    // --- API Functions ---
    const getApiToken = useCallback(async (clientId, clientSecret) => {
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
                },
                body: 'grant_type=client_credentials'
            });
            if (!response.ok) throw new Error('Failed to fetch token');
            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error('Error getting API token:', error);
            setCredentialError('Invalid credentials. Please check and try again.');
            return null;
        }
    }, []);

    const searchTracks = useCallback(async (query) => {
        if (!query || !spotifyApiToken) return;
        try {
            const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
                headers: { 'Authorization': `Bearer ${spotifyApiToken}` }
            });
            const data = await response.json();
            setSearchResults(data.tracks.items);
        } catch (error) {
            console.error('Error searching tracks:', error);
        }
    }, [spotifyApiToken]);
    
    const getAudioAnalysis = useCallback(async (trackId) => {
        if (!trackId || !spotifyApiToken) return;
        try {
            const response = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
                headers: { 'Authorization': `Bearer ${spotifyApiToken}` }
            });
            const data = await response.json();
            setAudioAnalysis(data);
        } catch (error) {
            console.error('Error getting audio analysis:', error);
        }
    }, [spotifyApiToken]);


    const playTrack = useCallback(async (trackUri) => {
        if (!deviceId) {
            setNotification("No active playback device found. Please open Spotify on any device.");
            return;
        }
        if (!credentials.oauthToken) {
            setNotification("Playback token is missing.");
            return;
        }
        try {
            const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${credentials.oauthToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uris: [trackUri] }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message);
            }
        } catch (error) {
            console.error('Error playing track:', error);
            setNotification(`Error: ${error.message}`);
        }
    }, [deviceId, credentials.oauthToken]);

    const togglePlay = useCallback(() => {
        if (spotifyPlayer) {
            spotifyPlayer.togglePlay();
        }
    }, [spotifyPlayer]);

    // --- Credential and Player Initialization ---
    const handleCredentialSave = async () => {
        if (!credentials.clientId || !credentials.clientSecret || !credentials.oauthToken) {
            setCredentialError('All fields are required.');
            return;
        }
        const token = await getApiToken(credentials.clientId, credentials.clientSecret);
        if (token) {
            setSpotifyApiToken(token);
            setShowCredentialsModal(false);
        }
    };

    useEffect(() => {
        // This effect initializes the Spotify Player once the SDK is loaded and credentials are provided
        if (!showCredentialsModal && window.Spotify && !spotifyPlayer) {
            const player = new window.Spotify.Player({
                name: 'React Canvas Visualizer',
                getOAuthToken: cb => { cb(credentials.oauthToken); }
            });

            player.addListener('ready', ({ device_id }) => {
                console.log('Player ready with Device ID', device_id);
                setDeviceId(device_id);
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setDeviceId(null);
            });

            player.addListener('authentication_error', ({ message }) => {
                setNotification(`Auth Error: ${message}. Please refresh and provide a valid token.`);
            });
            
            player.addListener('player_state_changed', state => {
                if (!state) return;
                setPlaybackState(state);
                setIsPlaying(!state.paused);
                setCurrentTrack(state.track_window.current_track);
            });

            player.connect();
            setSpotifyPlayer(player);
        }
        
        // Cleanup on component unmount
        return () => {
            if (spotifyPlayer) {
                spotifyPlayer.disconnect();
            }
        };
    }, [showCredentialsModal, credentials.oauthToken, spotifyPlayer, getApiToken]);
    
    // Effect to fetch audio analysis when the track changes
    useEffect(() => {
        if (currentTrack?.id) {
            getAudioAnalysis(currentTrack.id);
        }
    }, [currentTrack, getAudioAnalysis]);

    // --- Canvas Drawing Logic ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const resizeCanvas = () => {
            const container = canvas.parentElement;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const drawVisualizer = () => {
            animationFrameId.current = requestAnimationFrame(drawVisualizer);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (!audioAnalysis || !playbackState || playbackState.paused) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                return;
            }

            const progress = playbackState.position / 1000.0;
            
            const currentBeat = audioAnalysis.beats.find((beat, i) => {
                const nextBeat = audioAnalysis.beats[i + 1];
                return progress >= beat.start && (!nextBeat || progress < nextBeat.start);
            });

            const currentSegment = audioAnalysis.segments.find((segment, i) => {
                const nextSegment = audioAnalysis.segments[i + 1];
                return progress >= segment.start && (!nextSegment || progress < nextSegment.start);
            });

            if (currentBeat && currentSegment) {
                const timeSinceBeat = progress - currentBeat.start;
                const beatProgress = Math.min(timeSinceBeat / currentBeat.duration, 1);
                const brightness = 1 - (beatProgress * 0.7);
                const hue = (currentSegment.pitches.indexOf(Math.max(...currentSegment.pitches)) * 30);
                ctx.fillStyle = `hsla(${hue}, 70%, ${20 + 20 * brightness}%, 0.8)`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const segmentProgress = (progress - currentSegment.start) / currentSegment.duration;
                const loudness = Math.max(0, 1 + (currentSegment.loudness_max / 60)); 
                
                for (let i = 0; i < 12; i++) {
                    const pitch = currentSegment.pitches[i];
                    if (pitch > 0.5) {
                        const x = (canvas.width / 13) * (i + 1);
                        const y = canvas.height / 2;
                        const radius = (canvas.height / 5) * pitch * loudness * (1 - segmentProgress);
                        const alpha = (1 - segmentProgress) * pitch;

                        ctx.beginPath();
                        ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
                        ctx.fillStyle = `hsla(${(i * 30 + 180) % 360}, 90%, 70%, ${alpha})`;
                        ctx.fill();
                    }
                }
            }
        };

        drawVisualizer();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [audioAnalysis, playbackState]);
    
    // --- Notification Effect ---
    useEffect(() => {
        if (notification) {
            clearTimeout(notificationTimeout.current);
            notificationTimeout.current = setTimeout(() => setNotification(''), 4000);
        }
    }, [notification]);

    // --- Debounced Search ---
    const handleSearchChange = (e) => {
        const query = e.target.value;
        // Simple debounce
        setTimeout(() => {
            if (searchInputRef.current && query === searchInputRef.current.value) {
                searchTracks(query);
            }
        }, 300);
    };

    // --- Render Logic ---
    if (showCredentialsModal) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40">
                <div className="bg-spotify-light-dark p-8 rounded-lg shadow-2xl w-full max-w-md mx-4">
                    <h2 className="text-2xl font-bold mb-2 text-center">Spotify Credentials</h2>
                    <p className="text-gray-400 mb-6 text-center text-sm">Provide your API and User credentials to begin.</p>
                    <div className="mb-4">
                        <label htmlFor="clientId" className="block text-sm font-medium text-gray-300 mb-1">Client ID</label>
                        <input type="text" id="clientId" value={credentials.clientId} onChange={handleCredentialChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-spotify-green focus:outline-none" placeholder="From your Spotify Dashboard" />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-300 mb-1">Client Secret</label>
                        <input type="text" id="clientSecret" value={credentials.clientSecret} onChange={handleCredentialChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-spotify-green focus:outline-none" placeholder="From your Spotify Dashboard" />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="oauthToken" className="block text-sm font-medium text-gray-300 mb-1">User OAuth Token</label>
                        <input type="text" id="oauthToken" value={credentials.oauthToken} onChange={handleCredentialChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-spotify-green focus:outline-none" placeholder="From the Spotify API Reference" />
                        <p className="text-xs text-gray-500 mt-1">Requires `streaming` and `playback` scopes. <a href="https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile" target="_blank" rel="noopener noreferrer" className="text-spotify-green underline">Get one here</a>.</p>
                    </div>
                    <button onClick={handleCredentialSave} className="w-full spotify-green text-white font-bold py-3 px-4 rounded-md transition duration-300">Save and Continue</button>
                    {credentialError && <p className="text-red-500 text-xs mt-4 text-center">{credentialError}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            {notification && (
                <div className="fixed top-0 left-1/2 -translate-x-1/2 mt-4 bg-red-600 text-white py-2 px-6 rounded-lg shadow-lg z-50">
                    <p>{notification}</p>
                </div>
            )}
            <div className="w-full max-w-5xl">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold tracking-tight">Spotify Canvas Visualizer</h1>
                    <p className="text-gray-400 mt-2">Search for a song, play it, and watch the music come to life.</p>
                </div>

                <div className="mb-8 max-w-2xl mx-auto">
                    <div className="relative">
                        <input type="text" ref={searchInputRef} onChange={handleSearchChange} placeholder="Search for a song..." className="w-full bg-spotify-light-dark rounded-full py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-spotify-green" />
                        {/* SVG Icon */}
                    </div>
                    <div className="mt-4 max-h-60 overflow-y-auto">
                        {searchResults.map(track => (
                            <div key={track.id} onClick={() => { playTrack(track.uri); setSearchResults([]); if(searchInputRef.current) searchInputRef.current.value = ''; }} className="flex items-center p-2 rounded-md hover:bg-spotify-light-dark cursor-pointer">
                                <img src={track.album.images[2]?.url || 'https://placehold.co/40x40'} className="w-10 h-10 rounded-sm mr-4" alt={track.name} />
                                <div>
                                    <div className="font-medium text-white">{track.name}</div>
                                    <div className="text-sm text-gray-400">{track.artists.map(a => a.name).join(', ')}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-spotify-light-dark rounded-lg shadow-xl overflow-hidden">
                    <canvas ref={canvasRef} className="w-full h-96 block"></canvas>
                    <div className="p-6 flex items-center space-x-4">
                        <img id="album-art" src={currentTrack?.album?.images[1]?.url || 'https://placehold.co/80x80/191414/282828?text=Spotify'} className="w-20 h-20 rounded-md shadow-md" alt="Album Art"/>
                        <div>
                            <h3 className="font-bold text-xl">{currentTrack?.name || 'Select a song'}</h3>
                            <p className="text-gray-400">{currentTrack?.artists?.map(a => a.name).join(', ') || 'Search above to get started'}</p>
                        </div>
                    </div>
                </div>
                
                {currentTrack && (
                    <div className="mt-6 flex justify-center items-center space-x-6">
                        <button onClick={togglePlay} className="bg-white text-spotify-dark rounded-full w-16 h-16 flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                            {isPlaying ? (
                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z"/></svg>
                            ) : (
                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M4.53 2.9A.75.75 0 003 3.5v13a.75.75 0 001.53.5A16.95 16.95 0 008.5 14.28V5.72a16.95 16.95 0 00-3.97-2.82zM9.5 5.72v8.56c1.22.47 2.51.72 3.83.72a18.46 18.46 0 004.17-.67V5.05a18.46 18.46 0 00-4.17-.67A18.53 18.53 0 009.5 5.72z"/></svg>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
