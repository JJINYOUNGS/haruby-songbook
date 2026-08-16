import { getStore } from "@netlify/blobs";

const GENRES = ["케이팝","제이팝","팝","발라드","댄스","아이돌","밴드","락","힙합","뮤지컬","인디","OST"];
const STORE_NAME = "harubi-songbook";
const KEY = "songs-v1";

const SEED_SONGS = [
  { id:"s1", title:"밤편지", artist:"아이유", genres:["발라드"], favorite:true },
  { id:"s2", title:"Dynamite", artist:"방탄소년단", genres:["케이팝","댄스"], favorite:true },
  { id:"s3", title:"Lemon", artist:"요네즈 켄시", genres:["제이팝","발라드"], favorite:false },
  { id:"s4", title:"Perfect", artist:"Ed Sheeran", genres:["팝","발라드"], favorite:false },
  { id:"s5", title:"TT", artist:"TWICE", genres:["아이돌","케이팝"], favorite:false },
  { id:"s6", title:"Blueming", artist:"아이유", genres:["댄스"], favorite:false },
];

function headers() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0"
  };
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers() });
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeSongs(input) {
  if (!Array.isArray(input)) return null;
  if (input.length > 1000) return null;

  const out = [];
  const ids = new Set();

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;

    const title = cleanText(raw.title, 120);
    const artist = cleanText(raw.artist, 120);
    if (!title || !artist) continue;

    let id = cleanText(raw.id, 80) || crypto.randomUUID();
    if (ids.has(id)) id = crypto.randomUUID();
    ids.add(id);

    const genres = Array.isArray(raw.genres)
      ? [...new Set(raw.genres.filter(g => GENRES.includes(g)))].slice(0, GENRES.length)
      : [];

    if (genres.length === 0) continue;

    out.push({
      id,
      title,
      artist,
      genres,
      favorite: raw.favorite === true
    });
  }

  return out;
}

export default async (req) => {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    let songs = await store.get(KEY, { type: "json" });

    if (!Array.isArray(songs)) {
      songs = SEED_SONGS;
      await store.setJSON(KEY, songs);
    }

    return response({ songs });
  }

  if (req.method === "PUT") {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 512_000) {
      return response({ error: "요청이 너무 큽니다." }, 413);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return response({ error: "JSON 형식이 아닙니다." }, 400);
    }

    const songs = sanitizeSongs(body?.songs);
    if (!songs) {
      return response({ error: "노래 목록 형식이 올바르지 않습니다." }, 400);
    }

    await store.setJSON(KEY, songs);
    return response({ ok: true, songs });
  }

  return response({ error: "지원하지 않는 요청입니다." }, 405);
};
