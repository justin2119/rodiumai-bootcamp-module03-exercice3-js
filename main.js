import 'dotenv/config';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

const require = createRequire(import.meta.url);
const SDK = await import('rodiumai');
const RodiumAI = SDK.default ?? SDK.RodiumAI ?? SDK;
const client = typeof RodiumAI === 'function' ? new RodiumAI({ apiKey: process.env.RODIUMAI_API_KEY }) : RodiumAI;
const rl = createInterface({ input, output });
const steps = ['Chat', 'Image', 'Vidéo'];
const model = (key, fallback) => process.env[key] || fallback;
const API_BASE = (process.env.RODIUMAI_BASE_URL || 'https://api.rodiumai.io/v1').replace(/\/$/, '');

function get(obj, ...keys) {
  for (const key of keys) if (obj?.[key] != null) return obj[key];
  return undefined;
}

async function apiRequest(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RODIUMAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    const error = new Error(message);
    error.name = payload?.error?.type || payload?.error?.code || 'RodiumAPIError';
    throw error;
  }
  return payload;
}

async function callFirst(candidates, args, fallback) {
  for (const [target, method] of candidates) {
    const fn = typeof method === 'function' ? method : target?.[method];
    if (typeof fn === 'function') return fn.call(target, args);
  }
  // Use the documented HTTP API when this installed SDK version lacks a recognized method.
  return fallback();
}

async function saveResult(value, base) {
  if (!value) { console.log('Aucun contenu exploitable retourné.'); return; }
  await mkdir('outputs', { recursive: true });
  if (typeof value === 'string' && value.startsWith('data:') && value.includes(',')) {
    const [header, encoded] = value.split(',', 2);
    const suffix = header.includes('jpeg') ? '.jpg' : base === 'video' ? '.mp4' : '.png';
    const path = `outputs/${base}${suffix}`;
    await writeFile(path, Buffer.from(encoded, 'base64'));
    console.log(`Fichier enregistré : ${path}`);
    return;
  }
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    try {
      const response = await fetch(value);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const suffix = extname(new URL(value).pathname) || (base === 'video' ? '.mp4' : '.png');
      const path = `outputs/${base}${suffix}`;
      await writeFile(path, Buffer.from(await response.arrayBuffer()));
      console.log(`Fichier enregistré : ${path}`);
    } catch (error) {
      console.log(`Téléchargement impossible (${error.message}). URL du résultat : ${value}`);
    }
    return;
  }
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

async function runStep(index) {
  const prompt = (await rl.question(`\n${steps[index]} — votre demande : `)).trim();
  if (!prompt) { console.log('La demande est vide.'); return; }
  try {
    if (index === 0) {
      const payload = { model: model('RODIUMAI_CHAT_MODEL', 'rodium/auto'), messages: [{ role: 'user', content: prompt }] };
      const chat = client?.chat;
      const result = await callFirst([
        [chat?.completions, 'create'],
        [chat, 'create'],
        [null, typeof chat === 'function' ? chat : undefined],
        [client, 'createChatCompletion'],
        [client?.completions, 'create'],
      ], payload, () => apiRequest('/chat/completions', payload));
      console.log('\nRéponse :');
      console.log(get(get(result, 'choices')?.[0], 'message')?.content ?? get(result, 'output', 'content') ?? JSON.stringify(result, null, 2));
    } else if (index === 1) {
      const payload = { model: model('RODIUMAI_IMAGE_MODEL', 'openai/gpt-image-1.5'), prompt };
      const images = client?.images ?? client?.image;
      const result = await callFirst([
        [images, 'generate'], [images, 'create'],
        [client, 'generateImage'], [client, 'createImage'],
      ], payload, () => apiRequest('/images/generations', payload));
      const item = get(result, 'data', 'images')?.[0] ?? result;
      await saveResult(get(item, 'b64_json', 'url', 'image_url', 'content'), 'image');
    } else {
      const payload = { model: model('RODIUMAI_VIDEO_MODEL', 'google/veo-3.1-lite'), prompt };
      const videos = client?.videos ?? client?.video?.generations ?? client?.video;
      const result = await callFirst([
        [videos, 'generate'], [videos, 'create'],
        [client, 'generateVideo'], [client, 'createVideo'],
      ], payload, () => apiRequest('/videos/generations', payload));
      const item = get(result, 'data', 'videos')?.[0] ?? result;
      await saveResult(get(item, 'url', 'video_url', 'output_url') ?? JSON.stringify(result), 'video');
    }
  } catch (error) {
    const name = error?.name ?? 'Error';
    const hints = {
      InsufficientRODIError: 'Crédits RODI insuffisants pour cette opération : vérifiez le solde et le coût du modèle dans votre compte RodiumAI.',
      InsufficientBalanceError: 'Solde insuffisant : vérifiez votre compte RodiumAI.',
      InvalidAPIKeyError: 'Clé API invalide : vérifiez RODIUMAI_API_KEY dans .env.',
      AuthenticationError: 'Authentification refusée : vérifiez votre clé API.',
      RateLimitError: 'Limite de requêtes atteinte : réessayez plus tard.',
    };
    console.log(`Erreur (${name}) : ${hints[name] ?? error.message}`);
  }
}

try {
  if (!process.env.RODIUMAI_API_KEY) {
    console.error('RODIUMAI_API_KEY est manquante. Configurez .env ou votre environnement.');
    process.exitCode = 1;
  } else {
    let index = 0;
    while (index >= 0 && index < steps.length) {
      await runStep(index);
      console.log("\nNavigation : 1. Revenir à l'étape précédente  2. Refaire l'étape actuelle  3. Passer à la suite");
      const choice = (await rl.question('Votre choix (1/2/3) : ')).trim();
      if (choice === '1') index = Math.max(0, index - 1);
      else if (choice === '2') continue;
      else if (choice === '3') index += 1;
      else console.log("Choix invalide ; l'étape actuelle sera répétée.");
    }
    console.log('Parcours terminé.');
  }
} finally {
  rl.close();
}
