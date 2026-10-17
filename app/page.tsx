"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Link2,
  Copy,
  Check,
  Search,
  Bookmark,
  Compass,
  Users,
  MessageCircle,
  BarChart3,
  Settings2,
  Crown,
  Wifi,
  Send,
  RefreshCw,
  Film,
  Clapperboard,
  Heart,
  HelpCircle,
  Download,
  AlertCircle,
} from "lucide-react";
import { catalog, searchCatalog, recommendCatalog } from "../core/catalog.mjs";
import { canCorrectPlayback, playPosition } from "../core/playback.mjs";
import { springFrames } from "../core/motion";
import { correctedPosition, driftCorrection } from "../core/room-engine.mjs";

import type {
  FilmData,
  Room,
  Session,
  ApiResult,
  ModalKind,
  Connection,
} from "../core/types";
import { Logo, Modal, Avatar } from "../components/ui";
import { FilmGrid } from "../components/film-grid";
import { SocialPanel } from "../components/social-panel";
import { AccountMenu } from "../components/account-menu";
import { CinemaMotion, ReadyRoom, OpeningSequence, AmbientBackdrop } from "../components/cinema";

import { usePersonalLibrary, GlobalSearch, LibraryShelves, DownloadPlayer } from "../components/personal-library";

import { emojis, time } from "../core/format";

export default function Home() {
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const [name, setName] = useState("");
  const useAccountName = useCallback((value: string) => setName(current => current || value.slice(0, 24)), []);
  const [roomTitle, setRoomTitle] = useState(
    "Friday, but make it a movie night",
  );
  const [joinCode, setJoinCode] = useState("");
  const [chosenFilm, setChosenFilm] = useState("sintel");
  const [featuredId, setFeaturedId] = useState("sintel");
  const featured = catalog.find(f => f.id === featuredId) || catalog[0];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [section, setSection] = useState("discover");
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [connection, setConnection] = useState<Connection>("connecting");
  const [tab, setTab] = useState("chat");
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cinema, setCinema] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoFailure, setVideoFailure] = useState("");
  const [playbackPending, setPlaybackPending] = useState(false);
  const [waitingSince, setWaitingSince] = useState(0);
  const [videoLoading, setVideoLoading] = useState(true);
  const [drift, setDrift] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [reconnects, setReconnects] = useState(0);
  const [externalTitle, setExternalTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [pollQuestion, setPollQuestion] = useState(
    "What are we watching next?",
  );
  const [pollOptions, setPollOptions] = useState([
    "Sintel",
    "Big Buck Bunny",
    "Quiet Orbit",
  ]);
  const [localNow, setLocalNow] = useState(Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const lastSeekAtRef = useRef(0);
  const playbackBusyRef = useRef(false);
  const sceneRef = useRef<HTMLElement>(null);
  const scrubbingRef = useRef(false);
  const offsetSamples = useRef<{ offset: number; rtt: number }[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }, []);

  const personal = usePersonalLibrary(notify);
  const [offlineFilm, setOfflineFilm] = useState<FilmData | null>(null);
  const closeOffline = useCallback(() => setOfflineFilm(null), []);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    }), { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(element => { element.classList.add('will-reveal'); observer.observe(element); });
    return () => observer.disconnect();
  }, [section, !!room]);

  useEffect(() => {
    if (!sceneRef.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = sceneRef.current.animate(springFrames(room ? 28 : 18), { duration: 850, fill: 'both' });
    animation.finished.then(() => animation.cancel()).catch(() => {});
    return () => animation.cancel();
  }, [room?.code, section]);

  const accept = useCallback((next: Room) => {
    if (
      roomRef.current?.code === next.code &&
      next.revision < roomRef.current.revision
    )
      return;
    roomRef.current = next;
    setRoom(next);
  }, []);
  const calibrate = useCallback((serverNow: number, began: number) => {
    const received = Date.now(),
      rtt = received - began;
    offsetSamples.current = [
      ...offsetSamples.current,
      { offset: serverNow - (received + began) / 2, rtt },
    ].slice(-8);
    offsetRef.current = [...offsetSamples.current].sort(
      (a, b) => a.rtt - b.rtt,
    )[0].offset;
    setLatency(rtt);
  }, []);

  const act = useCallback(
    async (
      action: Record<string, unknown>,
      quiet = false,
    ): Promise<Room | null> => {
      const s = sessionRef.current;
      if (!s) return null;
      const began = Date.now();
      try {
        const response = await fetch("/api/party", {
          method: "POST",
          signal: AbortSignal.timeout(12000),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s.token}`,
          },
          body: JSON.stringify({ ...action, code: s.code }),
        });
        const result = (await response.json()) as ApiResult;
        if (!response.ok) {
          if (!quiet)
            notify(result.error || "That action could not be completed.");
          return null;
        }
        if (sessionRef.current?.token !== s.token) return null;
        calibrate(result.room.serverNow, began);
        accept(result.room);
        return result.room;
      } catch {
        if (!quiet)
          notify(
            "Connection interrupted. Your room will reconnect automatically.",
          );
        return null;
      }
    },
    [accept, calibrate, notify],
  );

  useEffect(() => {
    setName(localStorage.getItem("afterhours-name") || "");
    try {
      const ids = JSON.parse(localStorage.getItem("afterhours-saved") || "[]");
      if (Array.isArray(ids)) setSaved(ids.filter((id: unknown) => typeof id === "string" && catalog.some(f => f.id === id)));
    } catch {
      /* An old saved list can be safely discarded. */
    }
    const requested = new URLSearchParams(location.search)
      .get("room")
      ?.toUpperCase();
    const last = requested || sessionStorage.getItem("afterhours-active");
    if (!last) return;
    const token = sessionStorage.getItem(`afterhours-token-${last}`);
    if (!token) {
      setJoinCode(last);
      setModal("join");
      return;
    }
    const s = { code: last, token };
    sessionRef.current = s;
    setSession(s);
    const began = Date.now();
    fetch(`/api/party?room=${last}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const result = (await response.json()) as ApiResult;
        if (!response.ok) throw new Error(result.error);
        calibrate(result.room.serverNow, began);
        accept(result.room);
      })
      .catch((error) => {
        sessionRef.current = null;
        setSession(null);
        sessionStorage.removeItem("afterhours-active");
        setJoinCode(last);
        setModal("join");
        notify(error.message || "Join your room again.");
      });
  }, [accept, calibrate, notify]);

  useEffect(() => {
    if (!session) return;
    let stopped = false,
      controller: AbortController | null = null,
      timer: ReturnType<typeof setTimeout>,
      lastPacket = Date.now();
    const connect = async () => {
      controller = new AbortController();
      try {
        setConnection((c) => (c === "live" ? "reconnecting" : c));
        lastPacket = Date.now();
        const response = await fetch(
          `/api/party?room=${session.code}&stream=1`,
          {
            headers: { Authorization: `Bearer ${session.token}` },
            signal: controller.signal,
          },
        );
        if (!response.ok || !response.body) {
          const result = (await response
            .json()
            .catch(() => ({}))) as Partial<ApiResult>;
          if ([403, 404, 410].includes(response.status)) {
            notify(result.error || "Please join your room again.");
            leaveLocal();
            return;
          }
          throw new Error("Connection failed");
        }
        if (stopped) return;
        setConnection("live");
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "";
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          lastPacket = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const packets = buffer.split("\n\n");
          buffer = packets.pop() || "";
          for (const packet of packets) {
            const data = packet
              .split("\n")
              .find((l) => l.startsWith("data: "))
              ?.slice(6);
            if (!data) continue;
            if (packet.startsWith("event: error")) {
              const error = JSON.parse(data);
              if ([403, 404, 410].includes(error.status)) {
                notify(error.message);
                leaveLocal();
                return;
              }
              throw new Error(error.message);
            }
            if (!stopped) accept(JSON.parse(data));
          }
        }
      } catch {
        if (!stopped) {
          setConnection(navigator.onLine ? "reconnecting" : "offline");
          setReconnects((n) => n + 1);
        }
      }
      if (!stopped) timer = setTimeout(connect, navigator.onLine ? 700 : 2500);
    };
    const reconnect = () => {
      if (!stopped) {
        clearTimeout(timer);
        controller?.abort();
      }
    };
    connect();
    const heartbeat = setInterval(() => {
      if (navigator.onLine) act({ type: "heartbeat" }, true);
    }, 8000);
    const watchdog = setInterval(() => {
      if (Date.now() - lastPacket > 18000) {
        setConnection(navigator.onLine ? "reconnecting" : "offline");
        controller?.abort();
      }
    }, 2000);
    const offline = () => {
      setConnection("offline");
      controller?.abort();
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", offline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      clearInterval(heartbeat);
      clearInterval(watchdog);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", offline);
    };
    // Session changes own the stream. Room updates must not recreate it.
  }, [session, accept, act, notify]);

  const leaveLocal = useCallback(() => {
    sessionRef.current = null;
    roomRef.current = null;
    setSession(null);
    setRoom(null);
    sessionStorage.removeItem("afterhours-active");
    history.replaceState({}, "", "/");
    setCinema(false);
  }, []);

  const syncVideo = useCallback(() => {
    const video = videoRef.current,
      r = roomRef.current;
    if (!video || !r || video.readyState < 1 || r.closed) return;
    const serverNow = Date.now() + offsetRef.current;
    const target = correctedPosition(
      r.playback,
      serverNow,
      video.duration,
    );
    const correction = driftCorrection(video.currentTime, target);
    setDrift(Math.abs(correction.drift) * 1000);
    if (!r.playback.playing && !video.paused) video.pause();
    const mayCorrect = canCorrectPlayback({ readyState: video.readyState, seeking: video.seeking, scrubbing: scrubbingRef.current, now: Date.now(), lastSeekAt: lastSeekAtRef.current });
    if (correction.seek !== null && mayCorrect) {
      try {
        lastSeekAtRef.current = Date.now();
        video.currentTime = correction.seek;
      } catch {
        /* Metadata may still be changing after a source switch. */
      }
    }
    if (!video.seeking) video.playbackRate = r.playback.playing ? correction.rate : 1;
    if (r.playback.playing && serverNow >= r.playback.updatedAt && target < (Number.isFinite(video.duration) ? video.duration : Infinity)) {
      if (video.paused)
        video
          .play()
          .then(() => setNeedsGesture(false))
          .catch(() => setNeedsGesture(true));
    } else if (!video.paused) video.pause();
  }, []);
  useEffect(() => {
    syncVideo();
  }, [room?.playback.updatedAt, room?.playback.media.id, room?.playback.media.src, syncVideo]);
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalNow(Date.now());
      syncVideo();
    }, 500);
    return () => clearInterval(timer);
  }, [syncVideo]);
  useEffect(() => {
    setVideoError(false);
    setVideoFailure("");
    lastSeekAtRef.current = 0;
    setWaitingSince(Date.now());
    setVideoLoading(true);
    setDuration(0);
    setCurrentTime(0);
  }, [room?.playback.media.id, room?.playback.media.src]);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = volume;
    }
  }, [muted, volume, room?.playback.media.id]);

  const isHost = !!room && room.hostId === room.memberId;
  const canControl = !!room && (isHost || !room.settings.hostOnly);
  const togglePlay = useCallback(async () => {
    const r = roomRef.current, video = videoRef.current;
    if (!r || !video || playbackBusyRef.current) return;
    if (r.settings.hostOnly && r.hostId !== r.memberId) {
      notify("The host has the remote. Tap to join playback if your browser asks.");
      return;
    }
    const position = playPosition({ currentTime: video.currentTime, duration: video.duration, ended: video.ended, playing: r.playback.playing });
    if (!r.playback.playing) {
      if (position === 0 && video.currentTime > .15) video.currentTime = 0;
      video.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
    } else video.pause();
    playbackBusyRef.current = true;
    setPlaybackPending(true);
    try {
      await act({ type: "playback", mediaId: r.playback.media.id, position, playing: !r.playback.playing });
    } finally {
      playbackBusyRef.current = false;
      setPlaybackPending(false);
      syncVideo();
    }
  }, [act, notify, syncVideo]);

  const seek = (position: number) => {
    if (!room || !canControl) return;
    act({
      type: "playback",
      mediaId: room.playback.media.id,
      position: Math.max(0, Math.min(duration || 86400, position)),
      playing: room.playback.playing,
    });
  };
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else
      playerRef.current
        ?.requestFullscreen?.()
        .catch(() =>
          notify(
            "Fullscreen is not available in this browser. Try theater mode.",
          ),
        );
  }, [notify]);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        !roomRef.current ||
        modal ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(
          (e.target as HTMLElement)?.tagName,
        ) ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key.toLowerCase() === "m") setMuted((m) => !m);
      if (e.key.toLowerCase() === "f") fullscreen();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modal, togglePlay, fullscreen]);

  async function enterRoom(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const began = Date.now();
      const response = await fetch("/api/party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          modal === "join"
            ? {
                type: "join",
                name,
                code: joinCode.replace(/\s/g, "").toUpperCase(),
              }
            : { type: "create", name, title: roomTitle, mediaId: chosenFilm },
        ),
      });
      const result = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(result.error);
      const s = { code: result.room.code, token: result.token };
      sessionStorage.setItem(`afterhours-token-${s.code}`, s.token);
      sessionStorage.setItem("afterhours-active", s.code);
      localStorage.setItem("afterhours-name", name.trim());
      sessionRef.current = s;
      setSession(s);
      calibrate(result.room.serverNow, began);
      accept(result.room);
      history.replaceState({}, "", `?room=${s.code}`);
      closeModal();
      setConnection("connecting");
      notify(
        modal === "join"
          ? "You’re in. Grab the good seat."
          : "Your room is ready. Bring your people.",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not open the room. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const bookmark = (id: string) => {
    const next = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    setSaved(next);
    localStorage.setItem("afterhours-saved", JSON.stringify(next));
  };
  async function copyInvite() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${room.code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify("Copy the room link from the invite box.");
    }
  }
  async function addToQueue(film: FilmData) {
    const result = await act({ type: "queue-add", id: film.id });
    if (result) notify(`${film.title} is in the queue.`);
  }
  const openCreate = (filmId = "sintel") => {
    setChosenFilm(filmId);
    setModal("create");
  };
  const online =
    room?.members.filter((m) => m.online && localNow + offsetRef.current - m.lastSeen < 30000) ||
    [];
  const filteredFilms = searchCatalog(query, category).filter(f => {
    if (section === 'saved') return saved.includes(f.id);
    if (section === 'favorites') return personal.favorites.includes(f.id);
    if (section === 'downloads') return personal.downloads.includes(f.id);
    return !personal.hidden.includes(f.id);
  });
  const suggestions = recommendCatalog(saved, personal.favorites, personal.hidden);
  const media = room?.playback.media;
  const hasAudio = !media || !["orbit", "tides", "floodlights"].includes(media.id);
  const sectionTitle = section === 'saved' ? 'Your watch-later collection' : section === 'favorites' ? 'The ones you love.' : section === 'downloads' ? 'Your downloaded clips.' : 'Pick the next screening.';
  function filmCards(inRoom = false, films = filteredFilms) {
    return <FilmGrid films={films} inRoom={inRoom} saved={saved} bookmark={bookmark} addToQueue={addToQueue} openCreate={openCreate}
      favorites={personal.favorites} downloads={personal.downloads} downloading={personal.downloading} favorite={personal.favorite} hide={personal.hide} download={personal.download}
      onOpen={!inRoom && section === 'downloads' ? setOfflineFilm : undefined} />;
  }
  function browseSection(next: string) { setSection(next); setQuery(''); setCategory('All'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  return (
    <div
      className={`app-shell ${room ? "in-room" : ""} ${cinema ? "theater" : ""}`}
    >
      <AmbientBackdrop src={room?.playback.media.src || featured.src} poster={room?.playback.media.poster || featured.poster} />
      {!room && <OpeningSequence />}
      <aside className="rail" aria-label="Main navigation">
        <button
          className="rail-logo"
          aria-label="Neostance home"
          onClick={() => {
            if (room) notify("Leave the room to return to Discover.");
            else {
              setSection("discover");
              setQuery("");
            }
          }}
        >
          <Logo compact />
        </button>
        <div className="rail-nav">
          <button
            className={`rail-button ${!room && section === "discover" ? "active" : ""}`}
            title="Discover"
            aria-label="Discover"
            onClick={() => {
              if (room) setModal("library");
              else setSection("discover");
            }}
          >
            <Compass size={22} />
          </button>
          <button
            className={`rail-button ${section === "saved" && !room ? "active" : ""}`}
            title="Your watchlist"
            aria-label="Your watchlist"
            onClick={() => {
              if (room) {
                setSection("saved");
                setModal("library");
              } else setSection("saved");
            }}
          >
            <Bookmark size={21} />
            {saved.length > 0 && <span className="rail-dot" />}
          </button>
          <button
            className={`rail-button ${room ? "active" : ""}`}
            title={room ? "Your room" : "Join a room"}
            aria-label={room ? "Your room" : "Join a room"}
            onClick={() => (room ? setModal("invite") : setModal("join"))}
          >
            <Users size={22} />
          </button>
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            aria-label="How Neostance works"
            title="How it works"
            onClick={() => setModal("about")}
          >
            <HelpCircle size={21} />
          </button>
          <span className="rail-monogram" title="Vishv Ranoliya">
            VR
          </span>
        </div>
      </aside>
      <div className="site-content">
        <header className="topbar">
          <button
            className="brand-button"
            onClick={() => (room ? setModal("about") : setSection("discover"))}
          >
            <Logo />
          </button>
          <span className="topbar-note">
            A little closer, one movie at a time.
          </span>
          <div className="topbar-actions">
            <AccountMenu onName={useAccountName} />
            {room ? (
              <>
                <span className={`connection ${connection}`}>
                  <span className="status-dot" />
                  {connection === "live"
                    ? "Connected"
                    : connection === "offline"
                      ? "Offline"
                      : connection === "connecting"
                        ? "Connecting"
                        : "Reconnecting"}
                </span>
                <button
                  className="icon-button"
                  onClick={() => {
                    setRoomTitle(room.title);
                    setModal("settings");
                  }}
                  aria-label="Room settings"
                >
                  <Settings2 size={20} />
                </button>
              </>
            ) : (
              <>
                <button
                  className="text-button header-join"
                  onClick={() => setModal("join")}
                >
                  Join a room <ArrowUpRight size={16} />
                </button>
                <button
                  className="button button-small button-cream"
                  onClick={() => openCreate()}
                >
                  Create a room <Plus size={16} />
                </button>
              </>
            )}
          </div>
        </header>

        {!room ? (
          <main className="lobby" ref={sceneRef}>
            <div className="lobby-nav">
              <nav aria-label="Browse films">
                <button
                  className={section === "discover" ? "selected" : ""}
                  onClick={() => {
                    setSection("discover");
                    setQuery("");
                  }}
                >
                  Discover
                </button>
                {[
                  ['saved', 'Watch later', saved.length],
                  ['favorites', 'Favourites', personal.favorites.length],
                  ['downloads', 'Downloads', personal.downloads.length],
                ].map(([id,label,count]) => <button key={id} className={section === id ? 'selected' : ''} onClick={() => browseSection(String(id))}>{label}{Number(count)>0 && <span className="count">{count}</span>}</button>)}
              </nav>
              <GlobalSearch onChoose={openCreate} />
            </div>
            {section === "discover" && (
              <section className="hero">
                <img
                  className="hero-image"
                  src={featured.poster}
                  alt={`A scene from ${featured.title}`}
                />
                <div className="hero-image-shade" />
                <div className="hero-grain" />
                <CinemaMotion src={featured.src} poster={featured.poster} />
                <div className="hero-content">
                  <span className="eyebrow">
                    <span className="mini-line" /> YOUR PEOPLE. YOUR SCREEN. YOUR NIGHT.
                  </span>
                  <h1 className="neo-hero-identity" aria-label="Neostance">Neostance<span>.</span></h1>
                  <div className="neo-hero-story"><h2>One screen.<br/><em>A little closer.</em></h2><p>A room for your favourite people.<br/>A shared timeline for the stories that bring you together.</p></div>
                  <div className="hero-actions neo-room-options">
                    <button className="neo-room-option primary" onClick={() => openCreate(featured.id)}><span className="room-option-icon"><Plus size={22}/></span><span><strong>Create a room</strong><small>You set the scene.</small></span><ArrowUpRight size={20}/></button>
                    <button className="neo-room-option" onClick={() => setModal('join')}><span className="room-option-icon"><Link2 size={21}/></span><span><strong>Join your people</strong><small>One code. You're in.</small></span><ArrowUpRight size={20}/></button>
                  </div>
                  <div className="hero-promise">
                    <span>
                      <Wifi size={14} /> Watch in sync
                    </span>
                    <span>
                      <MessageCircle size={14} /> Talk through the good bits
                    </span>
                  </div>
                </div>
                <div className="hero-caption">
                  <span className="hero-caption-line" />
                  <div>
                    <span>TONIGHT’S FIRST PICK</span>
                    <button onClick={() => openCreate(featured.id)}>{featured.title} <ArrowUpRight size={15}/></button>
                    <p>{featured.label}</p>
                  </div>
                  <span className="hero-index">
                    01<span>/05</span>
                  </span>
                </div>
                <div className="hero-screenings" aria-label="Featured screenings">{catalog.filter(f => ['sintel','bunny','floodlights'].includes(f.id)).map((f,i) => <button key={f.id} className={featuredId === f.id ? 'active' : ''} aria-pressed={featuredId === f.id} onClick={() => setFeaturedId(f.id)}><span>0{i+1}</span>{f.title}<i/></button>)}</div>
              </section>
            )}
            {section !== 'discover' && (
              <section className={`saved-heading collection-hero collection-${section}`}>
                <div className="collection-hero-copy"><span className="eyebrow amber"><Bookmark size={15}/> YOUR OWN LITTLE CINEMA</span>
                <h1>{section === 'saved' ? <>Great nights.<br/><em>Already lined up.</em></> : section === 'favorites' ? <>Good stories.<br/><em>Great taste.</em></> : <>Your screen.<br/><em>Ready to go.</em></>}</h1>
                <p>{section === 'saved' ? 'A shortlist worth staying in for. Your saved picks, ready for your next shared night.' : section === 'favorites' ? 'Keep your favourites close. Your choices also shape the suggestions below.' : 'Clips saved in this browser. Play a local copy while Neostance is open; rooms and chat need a connection.'}</p></div>
                <div className="collection-hero-art" aria-hidden="true"><span className="collection-orbit"/>{[...catalog].filter(f => section === 'downloads' ? personal.downloads.includes(f.id) : section === 'favorites' ? personal.favorites.includes(f.id) : saved.includes(f.id)).concat(catalog).slice(0,3).map((f,i)=><img key={`${f.id}-${i}`} src={f.poster} alt="" style={{'--poster-index':i} as React.CSSProperties}/>) }<span className="collection-ticket">YOUR NEXT GOOD NIGHT<br/><strong>{section === 'favorites' ? personal.favorites.length : section === 'downloads' ? personal.downloads.length : saved.length} STORIES KEPT</strong></span></div>
              </section>
            )}
            <section className="discover-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow muted">
                    {section === "saved"
                      ? "YOUR COLLECTION"
                      : "SMALL COLLECTION. GOOD COMPANY."}
                  </span>
                  <h2>{sectionTitle}<span className="amber"> ✳</span></h2>
                </div>
                <label className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Search movies"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="A title, a mood, a tiny typo…"
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>
              <div className="category-row">
                <div className="category-chips">
                  {["All", ...new Set(catalog.map(f => f.category))].map((c) => (
                    <button
                      className={category === c ? "active" : ""}
                      key={c}
                      onClick={() => setCategory(c)}
                    >
                      {c === "All" && <Film size={14} />}{" "}
                      {c === "All" ? "All stories" : c}
                    </button>
                  ))}
                </div>
                <span className="catalog-note">
                  Small collection. Big shared moments.
                </span>
              </div>
              {filteredFilms.length ? (
                filmCards()
              ) : (
                <div className="empty-state">
                  <Bookmark size={28} />
                  <h3>
                    {section === 'downloads' && !personal.downloads.length ? 'Your next offline moment starts here.' : section === 'favorites' && !personal.favorites.length ? 'Keep the stories you love.' : section === "saved" && !saved.length ? "A good night deserves a shortlist." : "No stories here just yet."}
                  </h3>
                  <p>
                    {section === 'downloads' && !personal.downloads.length ? 'Open a story’s preview and choose Save offline to keep a clip in this browser.' : section === 'favorites' && !personal.favorites.length ? 'Tap the heart in a story’s preview to make it a favourite.' : section === "saved" && !saved.length ? "Tap a bookmark on Discover to save your next watch." : "Try another title, mood or category."}
                  </p>
                  <button
                    className="text-button amber"
                    onClick={() => {
                      setSection("discover");
                      setQuery("");
                      setCategory("All");
                    }}
                  >
                    Explore the collection <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </section>
            {personal.hidden.length > 0 && <div className="hidden-preferences"><span>{personal.hidden.length} {personal.hidden.length === 1 ? 'story hidden' : 'stories hidden'} from Discover and suggestions.</span><button onClick={personal.restore}>Restore hidden stories</button></div>}
            <LibraryShelves saved={saved} favorites={personal.favorites} downloads={personal.downloads} onSection={browseSection} />
            <section className="recommendations reveal"><div className="section-heading"><div><span className="eyebrow amber">{saved.length || personal.favorites.length ? 'INSPIRED BY YOUR PICKS' : 'A GOOD PLACE TO START'}</span><h2>{saved.length || personal.favorites.length ? 'More your kind of night.' : 'Good stories find good company.'}</h2></div><p>Based on shared genres and moods.<br/>Your favourites count a little more.</p></div>{suggestions.length ? <FilmGrid films={suggestions} saved={saved} bookmark={bookmark} addToQueue={addToQueue} openCreate={openCreate} favorites={personal.favorites} favorite={personal.favorite} hide={personal.hide} download={personal.download} downloads={personal.downloads} downloading={personal.downloading}/> : <div className="empty-state"><Heart size={28}/><h3>You know the whole collection.</h3><p>Your favourites and watch-later picks are ready above.</p></div>}</section>

          </main>
        ) : (
          <main className="room-page" ref={sceneRef}>
            {room.closed ? (
              <div className="room-ended">
                <Clapperboard size={42} />
                <span className="eyebrow amber">THAT’S A WRAP</span>
                <h1>Same time next movie?</h1>
                <p>
                  The host ended this room. Your next good night is one click
                  away.
                </p>
                <button className="button button-amber" onClick={leaveLocal}>
                  Back to Discover <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <>
                <div className="room-heading">
                  <div>
                    <span className="eyebrow muted">
                      <span className="live-indicator" /> YOUR PEOPLE. ONE
                      SCREEN.
                    </span>
                    <h1>{room.title}</h1>
                  </div>
                  <div className="room-heading-actions">
                    <div className="avatar-stack">
                      {online.slice(0, 4).map((m) => (
                        <Avatar key={m.id} member={m} size="small" />
                      ))}
                    </div>
                    <span className="online-count">{online.length} here</span>
                    <button
                      className="button button-small button-amber"
                      onClick={() => setModal("invite")}
                    >
                      <Plus size={16} /> Invite friends
                    </button>
                  </div>
                </div>
                <div className="room-grid">
                  <section className="screen-column">
                    <div className={`player neo-player ${room.playback.playing ? 'is-rolling' : ''}`} ref={playerRef}>
                      <video
                        key={`${media?.id}:${media?.src}`}
                        ref={videoRef}
                        src={media?.src}
                        poster={media?.poster || undefined}
                        preload="auto"
                        playsInline
                        disablePictureInPicture
                        controlsList="nodownload noremoteplayback"
                        muted={muted}
                        onLoadedMetadata={(e) => {
                          setDuration(e.currentTarget.duration);
                          syncVideo();
                        }}
                        onTimeUpdate={(e) => {
                          if (!scrubbingRef.current)
                            setCurrentTime(e.currentTarget.currentTime);
                        }}
                        onCanPlay={() => {
                          setVideoLoading(false);
                          syncVideo();
                        }}
                        onSeeked={() => { setVideoLoading(false); syncVideo(); }}
                        onWaiting={() => { setVideoLoading(true); setWaitingSince(Date.now()); }}
                        onPlaying={() => setVideoLoading(false)}
                        onError={(e) => {
                          const code = e.currentTarget.error?.code;
                          setVideoFailure(code === 2 ? 'The video request was interrupted. Retry to reconnect to the source.' : code === 3 ? 'Your browser could not decode this video. Try another bundled screening or open the source below.' : 'This source is unavailable or unsupported in this browser.');
                          setVideoError(true);
                          setVideoLoading(false);
                        }}
                        onEnded={() => {
                          if (canControl)
                            act({
                              type: "playback",
                              mediaId: media?.id,
                              position:
                                videoRef.current?.duration || currentTime,
                              playing: false,
                            });
                        }}
                      />
                      <div className="player-vignette" />
                      <span className="screening-corner" aria-hidden="true">N / SHARED SCREEN</span>
                      {room.playback.playing && room.playback.updatedAt > localNow + offsetRef.current && (
                        <div className="start-countdown" role="status" aria-live="polite">
                          <span>LIGHTS DOWN. EVERYONE TOGETHER.</span>
                          <strong key={Math.ceil((room.playback.updatedAt - localNow - offsetRef.current) / 1000)}>
                            {Math.ceil((room.playback.updatedAt - localNow - offsetRef.current) / 1000)}
                          </strong>
                          <small>Your screen starts with the room.</small>
                        </div>
                      )}
                      <div className="player-top">
                        <span className="player-badge">
                          <span className="mini-live" />{" "}
                          {room.playback.playing
                            ? "NOW PLAYING"
                            : "READY WHEN YOU ARE"}
                        </span>
                        <button
                          className={`sync-pill ${connection !== "live" ? "unstable" : ""}`}
                          onClick={() => {
                            syncVideo();
                            notify(
                              connection === "live"
                                ? "You’re following the room’s playback."
                                : "Reconnecting to your room…",
                            );
                          }}
                          title="Synchronize with the room"
                        >
                          <span className="status-dot" />
                          {connection === "live"
                            ? drift < 500
                              ? "Following the room"
                              : "Catching up"
                            : "Reconnecting"}
                          <RefreshCw size={11} />
                        </button>
                      </div>
                      {!room.playback.playing && !videoError && (
                        <button
                          className="big-play"
                          disabled={playbackPending}
                          onClick={togglePlay}
                          aria-label="Play for the room"
                        >
                          <Play size={28} fill="currentColor" />
                          <span>
                            {canControl
                              ? "Let the night begin"
                              : "The host has the remote"}
                          </span>
                        </button>
                      )}
                      {room.playback.playing && videoLoading && !videoError && (
                        <div className="buffer-indicator">
                          <span className="spinner" /> {localNow - waitingSince > 12000 ? 'Still loading. Check the source or retry below.' : 'Bringing everyone onto the same frame…'}
                          {localNow - waitingSince > 12000 && <button onClick={() => { setWaitingSince(Date.now()); videoRef.current?.load(); }}>Retry video</button>}
                        </div>
                      )}
                      {needsGesture && !videoError && (
                        <button
                          className="gesture-prompt"
                          onClick={() => {
                            videoRef.current
                              ?.play()
                              .then(() => {
                                setNeedsGesture(false);
                                syncVideo();
                              })
                              .catch(() =>
                                notify("Try the play control again."),
                              );
                          }}
                        >
                          <Play size={20} /> Tap to join playback
                        </button>
                      )}
                      {videoError && (
                        <div className="video-error">
                          <AlertCircle size={30} />
                          <h3>This video needs another take.</h3>
                          <p>
                            {videoFailure || 'Try again, or pick another screening from your queue.'}
                          </p>
                          <button
                            className="button button-small button-cream"
                            onClick={() => {
                              setVideoError(false);
                              setVideoLoading(true);
                              videoRef.current?.load();
                            }}
                          >
                            Retry video <RefreshCw size={15} />
                          </button>
                          <div className="video-recovery-actions"><a href={media?.src} target="_blank" rel="noreferrer">Open video source <ArrowUpRight size={14}/></a><button onClick={() => setModal('library')}>Choose another screening</button></div>
                        </div>
                      )}
                      <div className="floating-reactions" aria-hidden="true">
                        {room.reactions
                          .filter(
                            (r) => localNow + offsetRef.current - r.at < 6000,
                          )
                          .map((r) => (
                            <span
                              key={r.id}
                              className="floating-reaction"
                              style={{
                                left: `${10 + (r.id.charCodeAt(0) % 75)}%`,
                              }}
                            >
                              {r.emoji}
                              <small>{r.name}</small>
                            </span>
                          ))}
                      </div>
                      <div className="player-controls">
                        <input
                          className="scrubber"
                          type="range"
                          min="0"
                          max={duration || 1}
                          step="0.1"
                          value={Math.min(currentTime, duration || 1)}
                          onPointerDown={() => {
                            scrubbingRef.current = true;
                          }}
                          onChange={(e) =>
                            setCurrentTime(Number(e.target.value))
                          }
                          onPointerUp={(e) => {
                            scrubbingRef.current = false;
                            seek(Number(e.currentTarget.value));
                          }}
                          onKeyUp={(e) => seek(Number(e.currentTarget.value))}
                          onBlur={() => {
                            if (scrubbingRef.current) {
                              scrubbingRef.current = false;
                              seek(currentTime);
                            }
                          }}
                          disabled={!canControl || !duration}
                          aria-label="Seek video for everyone"
                          style={
                            {
                              "--progress": `${duration ? (currentTime / duration) * 100 : 0}%`,
                            } as React.CSSProperties
                          }
                        />
                        <div className="player-controls-row">
                          <div>
                            <button
                              className="player-icon"
                              aria-label={
                                room.playback.playing
                                  ? "Pause for everyone"
                                  : "Play for everyone"
                              }
                              onClick={togglePlay}
                            >
                              {room.playback.playing ? (
                                <Pause size={20} fill="currentColor" />
                              ) : (
                                <Play size={20} fill="currentColor" />
                              )}
                            </button>
                            <button
                              className="player-icon"
                              disabled={!hasAudio}
                              title={hasAudio ? 'Your audio is independent of the room' : 'This original motion study is silent'}
                              onClick={() => setMuted((m) => !m)}
                              aria-label={
                                muted ? "Unmute your audio" : "Mute your audio"
                              }
                            >
                              {muted ? (
                                <VolumeX size={19} />
                              ) : (
                                <Volume2 size={19} />
                              )}
                            </button>
                            <input
                              className="volume-slider"
                              disabled={!hasAudio}
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={muted ? 0 : volume}
                              onChange={(e) => {
                                setVolume(Number(e.target.value));
                                setMuted(Number(e.target.value) === 0);
                              }}
                              aria-label="Your volume"
                            />
                            <span className="timecode">
                              {time(currentTime)}{" "}
                              <span>/ {time(duration)}</span>
                            </span>
                          </div>
                          <div>
                            <span className="host-remote">
                              {room.settings.hostOnly ? (
                                <>
                                  <Crown size={12} /> Host controls
                                </>
                              ) : (
                                <>
                                  <Users size={12} /> Shared controls
                                </>
                              )}
                            </span>
                            <button
                              className="player-icon"
                              onClick={() => setCinema((c) => !c)}
                              aria-label={
                                cinema ? "Exit theater mode" : "Theater mode"
                              }
                              title="Theater mode"
                            >
                              {cinema ? (
                                <Minimize size={18} />
                              ) : (
                                <Film size={18} />
                              )}
                            </button>
                            <button
                              className="player-icon"
                              onClick={fullscreen}
                              aria-label="Fullscreen"
                              title="Fullscreen (F)"
                            >
                              <Maximize size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <ReadyRoom room={room} serverNow={localNow + offsetRef.current} act={act} />
                    <div className="now-playing">
                      <div>
                        <span className="eyebrow muted">
                          ON YOUR SHARED SCREEN
                        </span>
                        <h2>
                          {media?.title}
                          <span>
                            {media?.year} <span>·</span> {media?.category}
                          </span>
                        </h2>
                        <p>{media?.description}</p>
                      </div>
                      <button
                        className="icon-button"
                        title="Browse the collection"
                        aria-label="Browse videos"
                        onClick={() => {
                          setSection("discover");
                          setQuery("");
                          setCategory("All");
                          setModal("library");
                        }}
                      >
                        <Plus size={21} />
                      </button>
                    </div>
                    <div className="reaction-strip">
                      <span>The scene deserves a reaction.</span>
                      <div>
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => act({ type: "reaction", emoji })}
                            aria-label={`Send ${emoji} to the room`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {
                          syncVideo();
                          notify("Playback synchronized.");
                        }}
                      >
                        <RefreshCw size={14} /> Re-sync
                      </button>
                    </div>
                    <div className="screen-foot">
                      <span>{media?.credit}{!hasAudio && ' · Silent original short'}</span>
                      <span>
                        SPACE play / pause <span>·</span> M mute <span>·</span>{" "}
                        F fullscreen
                      </span>
                    </div>
                    <section className="up-next-section">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow muted">
                            KEEP THE NIGHT GOING
                          </span>
                          <h2>
                            Up next
                            <span className="queue-counter">
                              {room.queue.length}
                            </span>
                          </h2>
                        </div>
                        <button
                          className="text-button amber"
                          onClick={() => {
                            setSection("discover");
                            setModal("library");
                          }}
                        >
                          <Plus size={15} /> Add a story
                        </button>
                      </div>
                      <div className="up-next-list">
                        {room.queue.map((film, i) => (
                          <div
                            className={`up-next-item ${film.id === media?.id ? "current" : ""}`}
                            key={film.id}
                          >
                            <span className="queue-index">
                              {film.id === media?.id ? (
                                <span
                                  className={`equalizer ${room.playback.playing ? "" : "paused"}`}
                                >
                                  <i />
                                  <i />
                                  <i />
                                </span>
                              ) : (
                                String(i + 1).padStart(2, "0")
                              )}
                            </span>
                            <img
                              src={film.poster || "/media/orbit.jpg"}
                              alt=""
                            />
                            <div>
                              <strong>{film.title}</strong>
                              <small>
                                {film.id === media?.id
                                  ? "On your screen"
                                  : film.category}{" "}
                                <span>·</span> {film.duration}
                              </small>
                            </div>
                            <button
                              className="icon-button"
                              disabled={!canControl}
                              onClick={() =>
                                act({ type: "select", id: film.id })
                              }
                              aria-label={`Put on ${film.title}`}
                              title={
                                canControl
                                  ? "Put on this video"
                                  : "The host controls playback"
                              }
                            >
                              <Play size={17} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  </section>
                  <SocialPanel
                    room={room}
                    localNow={localNow + offsetRef.current}
                    tab={tab}
                    onTab={setTab}
                    act={act}
                    openModal={setModal}
                    onBrowse={() => {
                      setSection("discover");
                      setModal("library");
                    }}
                    onLeave={leaveLocal}
                  />
                </div>
                <footer className="room-footer">
                  <span>
                    <span className="tiny-star">✳</span> Better stories. Even
                    better company.
                  </span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setRoomTitle(room.title);
                      setModal("settings");
                    }}
                  >
                    Your room, your rules <Settings2 size={14} />
                  </button>
                </footer>
              </>
            )}
          </main>
        )}
      </div>
      {offlineFilm && <DownloadPlayer film={offlineFilm} close={closeOffline} />}
      {modal && (
        <Modal
          title={
            modal === "create"
              ? "Make a night of it."
              : modal === "join"
                ? "Your people are waiting."
                : modal === "invite"
                  ? "Save them a seat."
                  : modal === "settings"
                    ? "Your room, your rules."
                    : modal === "library"
                      ? "What’s the next story?"
                      : modal === "poll"
                        ? "Let the room decide."
                        : "A little closer, together."
          }
          subtitle={
            modal === "create"
              ? "A name, a story, and your favorite people. That’s all."
              : modal === "join"
                ? "One room code. One shared screen. Come on in."
                : modal === "invite"
                  ? "Send a link or share the six-character room code."
                  : modal === "library"
                    ? "Open films, little escapes, or something of your own."
                    : undefined
          }
          close={closeModal}
          wide={modal === "library"}
        >
          {(modal === "create" || modal === "join") && (
            <div className="room-mode-switch" aria-label="Room entry options"><button className={modal === 'create' ? 'active' : ''} onClick={() => setModal('create')}><Plus size={17}/><span>Create a room<small>Make it your night.</small></span></button><button className={modal === 'join' ? 'active' : ''} onClick={() => setModal('join')}><Link2 size={17}/><span>Join a room<small>Your people are waiting.</small></span></button></div>
          )}
          {(modal === "create" || modal === "join") && (
            <form className="entry-form" onSubmit={enterRoom}>
              <label>
                Your name
                <input
                  required
                  autoComplete="given-name"
                  maxLength={28}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vishv"
                />
              </label>
              {modal === "create" ? (
                <>
                  <label>
                    Name your night
                    <input
                      required
                      maxLength={60}
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder="The after-class escape"
                    />
                  </label>
                  <label>
                    Start with
                    <select
                      value={chosenFilm}
                      onChange={(e) => setChosenFilm(e.target.value)}
                    >
                      {catalog.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.title} · {f.category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="entry-note">
                    <Users size={18} />
                    <p>
                      Your room starts with host controls.
                      <small>
                        You can share the remote anytime in Settings.
                      </small>
                    </p>
                  </div>
                </>
              ) : (
                <label>
                  Room code
                  <input
                    className="code-input"
                    required
                    pattern="[A-Za-z2-9]{6}"
                    maxLength={6}
                    autoComplete="off"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""),
                      )
                    }
                    placeholder="ABC234"
                  />
                </label>
              )}
              <button
                disabled={busy || !name.trim()}
                className="button button-amber full-width"
                type="submit"
              >
                {busy ? (
                  <>
                    <span className="spinner" /> Pulling up a seat…
                  </>
                ) : (
                  <>
                    {modal === "create" ? "Create my room" : "Join the night"}{" "}
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
              <button
                className="form-switch"
                type="button"
                onClick={() => setModal(modal === "create" ? "join" : "create")}
              >
                {modal === "create"
                  ? "Already invited? Join a room"
                  : "Starting something? Create a room"}
              </button>
            </form>
          )}
          {modal === "invite" && room && (
            <div className="invite-content">
              <div className="invite-ticket">
                <span>YOUR FRIENDS’ TICKET IN</span>
                <strong>{room.code}</strong>
                <div>
                  <span>AFTERHOURS</span>
                  <span>
                    ADMIT YOUR PEOPLE <ArrowUpRight size={13} />
                  </span>
                </div>
              </div>
              <label className="invite-url-label">
                Room link
                <input
                  readOnly
                  value={`${typeof location === "undefined" ? "" : location.origin}/?room=${room.code}`}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="button button-amber full-width"
                onClick={copyInvite}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                {copied ? "Copied. Go make their night." : "Copy invite link"}
              </button>
              <p className="fine-print">
                {room.settings.locked
                  ? "Your room is locked. Unlock it in Settings before friends join."
                  : "Anyone who can access this website and has the code can join. Lock the room in Settings once everyone is here."}
              </p>
            </div>
          )}
          {modal === "settings" && room && (
            <div className="settings-content">
              <form
                className="entry-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await act({ type: "rename", name });
                  localStorage.setItem("afterhours-name", name.trim());
                  notify("Your name has been updated.");
                }}
              >
                <label>
                  Your display name
                  <div className="inline-input">
                    <input
                      required
                      maxLength={28}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <button className="button button-outline button-small">
                      Save
                    </button>
                  </div>
                </label>
              </form>
              {isHost && (
                <>
                  <form
                    className="entry-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const result = await act({
                        type: "settings",
                        title: roomTitle,
                      });
                      if (result) notify("Room name updated.");
                    }}
                  >
                    <label>
                      Room name
                      <div className="inline-input">
                        <input
                          required
                          maxLength={60}
                          value={roomTitle}
                          onChange={(e) => setRoomTitle(e.target.value)}
                        />
                        <button className="button button-outline button-small">
                          Save
                        </button>
                      </div>
                    </label>
                  </form>
                  <div className="setting-row">
                    <div>
                      <strong>Keep the remote with the host</strong>
                      <p>Only the host can play, pause, seek or reorder.</p>
                    </div>
                    <button
                      className={`switch ${room.settings.hostOnly ? "on" : ""}`}
                      role="switch"
                      aria-label="Host-only playback controls"
                      aria-checked={room.settings.hostOnly}
                      onClick={() =>
                        act({
                          type: "settings",
                          hostOnly: !room.settings.hostOnly,
                        })
                      }
                    >
                      <span />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Lock the room</strong>
                      <p>
                        Keep new guests from joining after everyone arrives.
                      </p>
                    </div>
                    <button
                      className={`switch ${room.settings.locked ? "on" : ""}`}
                      role="switch"
                      aria-label="Lock room"
                      aria-checked={room.settings.locked}
                      onClick={() =>
                        act({ type: "settings", locked: !room.settings.locked })
                      }
                    >
                      <span />
                    </button>
                  </div>
                </>
              )}
              <div className="connection-details">
                <span>
                  <Wifi size={15} /> Connection check
                </span>
                <div>
                  <p>
                    Round trip{" "}
                    <strong>
                      {latency === null ? "Measuring…" : `${latency} ms`}
                    </strong>
                  </p>
                  <p>
                    Last measured playback difference{" "}
                    <strong>{Math.round(drift)} ms</strong>
                  </p>
                  <p>
                    Reconnect attempts <strong>{reconnects}</strong>
                  </p>
                </div>
                <small>
                  Live measurements from this browser. Network conditions and
                  buffering affect playback.
                </small>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(room, null, 2)], {
                      type: "application/json",
                    }),
                    url = URL.createObjectURL(blob),
                    a = document.createElement("a");
                  a.href = url;
                  a.download = `neostance-${room.code}.json`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                <Download size={15} /> Export this room’s chat and lineup
              </button>
              {isHost && (
                <button
                  className="button button-danger full-width"
                  onClick={async () => {
                    if (
                      confirm(
                        "End this room for everyone? This cannot be undone.",
                      )
                    ) {
                      const result = await act({ type: "close" });
                      if (result) closeModal();
                    }
                  }}
                >
                  End this movie night
                </button>
              )}
            </div>
          )}
          {modal === "library" && (
            <>
              <div className="library-toolbar">
                <label className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Search collection"
                    placeholder="A title or a mood…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {["All", ...new Set(catalog.map(f => f.category))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              {filteredFilms.length ? (
                filmCards(true)
              ) : (
                <div className="empty-state">
                  <p>No matches. Try another mood.</p>
                  <button
                    className="text-button amber"
                    onClick={() => {
                      setSection("discover");
                      setCategory("All");
                      setQuery("");
                    }}
                  >
                    Show all stories
                  </button>
                </div>
              )}
              <form
                className="external-video"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const result = await act({
                    type: "queue-add",
                    title: externalTitle,
                    src: externalUrl,
                  });
                  if (result) {
                    setExternalTitle("");
                    setExternalUrl("");
                    notify("Your video is in the room’s queue.");
                  }
                }}
              >
                <div>
                  <Link2 size={17} />
                  <h3>Bring your own story.</h3>
                </div>
                <p>
                  Use a publicly playable, direct HTTPS MP4 or WebM link.
                  YouTube, Netflix and webpage links aren’t direct video files.
                </p>
                <div className="external-inputs">
                  <input
                    required
                    maxLength={80}
                    aria-label="Video title"
                    placeholder="Give it a title"
                    value={externalTitle}
                    onChange={(e) => setExternalTitle(e.target.value)}
                  />
                  <input
                    required
                    type="url"
                    maxLength={1500}
                    aria-label="Direct video URL"
                    placeholder="https://example.com/video.mp4"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                  />
                  <button className="button button-amber button-small">
                    <Plus size={16} /> Add
                  </button>
                </div>
              </form>
            </>
          )}
          {modal === "poll" && (
            <form
              className="entry-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await act({
                  type: "poll-create",
                  question: pollQuestion,
                  options: pollOptions,
                });
                if (result) {
                  setTab("poll");
                  closeModal();
                  notify("The room gets a vote.");
                }
              }}
            >
              <label>
                Your question
                <input
                  required
                  maxLength={100}
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                />
              </label>
              {pollOptions.map((option, i) => (
                <label key={i}>
                  Option {i + 1}
                  <input
                    required={i < 2}
                    maxLength={60}
                    value={option}
                    onChange={(e) =>
                      setPollOptions((o) =>
                        o.map((s, j) => (j === i ? e.target.value : s)),
                      )
                    }
                  />
                </label>
              ))}
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  className="text-button amber"
                  onClick={() => setPollOptions((o) => [...o, ""])}
                >
                  <Plus size={15} /> Add another option
                </button>
              )}
              <button className="button button-amber full-width">
                Open the vote <BarChart3 size={16} />
              </button>
            </form>
          )}
          {modal === "about" && (
            <div className="about-content">
              <p>
                Neostance is a place to spend a little more time with your
                people. Pick a video, share a code, and watch the same story
                unfold together.
              </p>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <strong>Make a room.</strong>
                    <p>Choose a film or add your own direct video link.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Bring your people.</strong>
                    <p>
                      Share the invite. The host can lock the door when everyone
                      arrives.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Make it your night.</strong>
                    <p>
                      React, chat, build the queue, and vote on what happens
                      next.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="about-note">
                <Heart size={20} />
                <p>
                  Different places. Same good company.
                  <small>Vishv Ranoliya · 2026</small>
                </p>
              </div>
              <p className="fine-print">
                The included Blender short film, trailers and teasers credit their original creators.
                The ambient and stadium motion studies are original procedural artwork.
                Your watchlist stays on your device; room chat and lineups are
                shared with participants. Rooms expire after seven days.
              </p>
              <a
                className="text-button amber"
                href="/project-guide.html"
                target="_blank"
                rel="noreferrer"
              >
                Project setup & ownership guide <ArrowUpRight size={15} />
              </a>
              <a className="text-button amber" href="/still/index.html" target="_blank" rel="noreferrer">STILL · UI/UX case study <ArrowUpRight size={15} /></a>
            </div>
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-symbol">✳</span>
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
