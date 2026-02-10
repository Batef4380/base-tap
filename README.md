# BaseTap ⚡

A tap-to-earn mini app on Base chain. Tap to accumulate points, claim with one transaction, climb the leaderboard.

Built as a Farcaster Frame mini app with on-chain smart contract.

## Lokal Test

```bash
npm install
npm run dev
```

http://localhost:3000

## Icon Oluştur

1. http://localhost:3000/icon.html aç
2. "Download icon.png" → proje klasörüne taşı
3. "Download preview.png" → proje klasörüne taşı

## Smart Contract Deploy (Base Sepolia)

```bash
# Foundry kur
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Deploy
cd /Users/batuhanefe/Downloads/Basetap
forge create BaseTap.sol:BaseTap --rpc-url https://sepolia.base.org --private-key [PRIVATE_KEY]
```

Deploy sonrası alınan adresi `game.js` içindeki `CONTRACT_ADDRESS`'e yaz.

## Deploy (Vercel)

1. GitHub'da repo oluştur
2. `git init && git add . && git commit -m "first" && git branch -M main && git remote add origin [URL] && git push -u origin main`
3. vercel.com → GitHub bağla → deploy
4. URL'i al

## Farcaster

1. https://warpcast.com/~/developers/mini-apps → URL gir
2. accountAssociation bilgilerini `.well-known/farcaster.json`'a ekle
3. `[DOMAIN]` → Vercel URL ile değiştir

## Base App

1. Base App → Add Mini App → URL gir
2. Verilen `base:app_id` → `index.html` meta tag'e ekle
