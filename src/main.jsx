import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const API_BASE = "https://www.googleapis.com/youtube/v3";
const DEFAULT_QUERY = "nhạc remix mới nhất";
const RECENT_DAYS = 120;
const REMIX_TERMS = [
  "remix",
  "dj",
  "edm",
  "vinahouse",
  "nonstop",
  "mixset",
  "megamix",
];

function normalizeSearchText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function getRecentPublishedAfter() {
  const date = new Date();
  date.setDate(date.getDate() - RECENT_DAYS);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function buildApiQuery(value) {
  const normalized = normalizeSearchText(value);
  const lowerQuery = normalized.toLowerCase();
  const hasRemixIntent = REMIX_TERMS.some((term) => lowerQuery.includes(term));

  if (hasRemixIntent) {
    return normalized;
  }

  return `${normalized} remix`;
}

function formatPublishedAt(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function normalizeVideo(item) {
  const id = typeof item.id === "string" ? item.id : item.id?.videoId;

  return {
    id,
    title: item.snippet?.title ?? "Untitled video",
    channelTitle: item.snippet?.channelTitle ?? "Unknown channel",
    description: item.snippet?.description ?? "",
    publishedAt: item.snippet?.publishedAt ?? "",
    thumbnail:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      "",
  };
}

async function searchVideos({ query, pageToken, signal }) {
  const normalizedQuery = normalizeSearchText(query);

  const params = new URLSearchParams({
    key: API_KEY,
    part: "snippet",
    type: "video",
    maxResults: "12",
    order: "date",
    publishedAfter: getRecentPublishedAfter(),
    regionCode: "VN",
    relevanceLanguage: "vi",
    safeSearch: "moderate",
    videoCategoryId: "10",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    q: buildApiQuery(normalizedQuery),
    fields:
      "items(id/videoId,snippet(title,channelTitle,description,publishedAt,thumbnails)),nextPageToken",
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(`${API_BASE}/search?${params.toString()}`, {
    signal,
  });
  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ??
      "Khong the ket noi toi YouTube Data API. Hay kiem tra API key va quota.";
    throw new Error(message);
  }

  return {
    items: (data.items ?? []).map(normalizeVideo).filter((video) => video.id),
    nextPageToken: data.nextPageToken ?? "",
  };
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="m21 20-5.6-5.6a7 7 0 1 0-1.4 1.4L20 21l1-1ZM4 10a6 6 0 1 1 12 0 6 6 0 0 1-12 0Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

function App() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [activeQuery, setActiveQuery] = useState(DEFAULT_QUERY);
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [nextPageToken, setNextPageToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(null);

  const selectedVideoUrl = useMemo(() => {
    if (!selectedVideo) return "";
    return `https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1&rel=0`;
  }, [selectedVideo]);

  const runSearch = useCallback(
    async ({ next = false } = {}) => {
      if (!API_KEY) {
        setError("Thieu VITE_YOUTUBE_API_KEY trong file .env.local.");
        return;
      }

      const nextQuery = next ? activeQuery : normalizeSearchText(query);
      if (!nextQuery) return;

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      setError("");
      next ? setLoadingMore(true) : setLoading(true);

      try {
        const result = await searchVideos({
          query: nextQuery,
          pageToken: next ? nextPageToken : "",
          signal: controller.signal,
        });

        setActiveQuery(nextQuery);
        setNextPageToken(result.nextPageToken);
        setVideos((current) => (next ? [...current, ...result.items] : result.items));
        setSelectedVideo((current) => {
          if (next) return current;
          return result.items[0] ?? null;
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          next ? setLoadingMore(false) : setLoading(false);
        }
      }
    },
    [activeQuery, nextPageToken, query],
  );

  useEffect(() => {
    runSearch();

    return () => {
      requestRef.current?.abort();
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    runSearch();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="YouTube Mini home">
          <span className="brand-mark">
            <PlayIcon />
          </span>
          <span>YouTube Mini</span>
        </a>

        <form className="search-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="search">
            Tim video
          </label>
          <input
            id="search"
            type="search"
            value={query}
            placeholder="Tim video, bai hat, kenh..."
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" disabled={loading || !query.trim()} title="Tim kiem">
            <SearchIcon />
            <span>Tim</span>
          </button>
        </form>
      </header>

      <section className="content-grid">
        <section className="watch-panel" aria-label="Trinh phat video">
          <div className="player-frame">
            {selectedVideo ? (
              <iframe
                title={selectedVideo.title}
                src={selectedVideoUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="empty-player">
                {loading ? "Dang tai video..." : "Nhap tu khoa de bat dau xem video."}
              </div>
            )}
          </div>

          <div className="video-meta">
            <p className="eyebrow">Dang xem</p>
            <h1>{selectedVideo?.title ?? "Chua co video nao duoc chon"}</h1>
            {selectedVideo && (
              <div className="meta-line">
                <span>{selectedVideo.channelTitle}</span>
                <span>{formatPublishedAt(selectedVideo.publishedAt)}</span>
              </div>
            )}
            {selectedVideo?.description && (
              <p className="description">{selectedVideo.description}</p>
            )}
          </div>
        </section>

        <aside className="results-panel" aria-label="Ket qua tim kiem">
          <div className="results-head">
            <div>
              <p className="eyebrow">Ket qua</p>
              <h2>{activeQuery}</h2>
            </div>
            <span className="count">{videos.length}</span>
          </div>

          {error && <div className="notice error">{error}</div>}

          <div className="video-list">
            {loading &&
              Array.from({ length: 5 }).map((_, index) => (
                <div className="video-skeleton" key={index} />
              ))}

            {!loading &&
              videos.map((video) => (
                <button
                  className={`video-item ${
                    selectedVideo?.id === video.id ? "is-active" : ""
                  }`}
                  key={video.id}
                  type="button"
                  onClick={() => setSelectedVideo(video)}
                >
                  <img src={video.thumbnail} alt="" loading="lazy" />
                  <span className="item-copy">
                    <strong>{video.title}</strong>
                    <span>{video.channelTitle}</span>
                    <small>{formatPublishedAt(video.publishedAt)}</small>
                  </span>
                </button>
              ))}

            {!loading && !error && videos.length === 0 && (
              <div className="notice">Khong tim thay video nao.</div>
            )}
          </div>

          {!loading && nextPageToken && (
            <button
              className="load-more"
              type="button"
              onClick={() => runSearch({ next: true })}
              disabled={loadingMore}
            >
              {loadingMore ? "Dang tai..." : "Tai them"}
            </button>
          )}
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
