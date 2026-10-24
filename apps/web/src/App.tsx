import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlayerState, SpeciesId, Tile } from "@botanical-story/shared";
import { SPECIES, getSpecies } from "@botanical-story/game-data";
import { growthState } from "@botanical-story/game-core";
import { buySeed, finishTutorial, harvestPlant, loadState, placeDecoration, plantSeed, sellPlant } from "./api";
import NurseryCanvas from "./NurseryCanvas";

type Mode = "plant" | "decorate";
type DecorationKind = "birdbath" | "bench" | "planter";
const empty: PlayerState = { playerId: "", coins: 0, xp: 0, level: 1, tutorialComplete: false, inventory: [], plants: [], decorations: [] };
export default function App() {
  const [state, setState] = useState<PlayerState>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("plant");
  const [speciesId, setSpeciesId] = useState<SpeciesId>("daisy");
  const [decoration, setDecoration] = useState<DecorationKind>("birdbath");
  const [selected, setSelected] = useState<Tile | null>(null);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const refresh = useCallback(async () => { const next = await loadState(); setState(next); setError(""); setReady(true); }, []);
  useEffect(() => { void refresh().catch((e: unknown) => { setError(e instanceof Error ? e.message : "Could not load the nursery."); setReady(true); }); }, [refresh]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);
  const inventory = useMemo(() => new Map(state.inventory.map((item) => [item.speciesId, item])), [state.inventory]);
  const growing = state.plants.filter((plant) => plant.status === "growing");
  const harvestedAtLeastOnce = state.plants.some((plant) => plant.status === "harvested");
  const hasAnySale = state.xp > 0;
  const activeSpecies = getSpecies(speciesId);
  const xpProgress = state.xp % 100;
  const tutorial = !state.tutorialComplete ? hasAnySale ? "Your first sale is in the books. Use your coins to grow a bigger nursery." : harvestedAtLeastOnce ? "Lovely harvest! Sell your flowers from the basket below to earn coins." : growing.length ? "Your flowers are growing. They sparkle when ready—tap one to harvest it." : "Tap an empty garden tile to plant a daisy. Your first seeds are ready." : "";
  const action = async (fn: () => Promise<unknown>, message?: string) => {
    if (busy) return; setBusy(true); setError("");
    try { await fn(); await refresh(); if (message) setToast(message); }
    catch (e) { setToast(e instanceof Error ? e.message : "That action did not work. Try again."); }
    finally { setBusy(false); }
  };
  const onTile = (x: number, y: number) => {
    setSelected({ x, y });
    const plant = growing.find((item) => item.x === x && item.y === y);
    if (plant) {
      const growth = growthState(Date.parse(plant.plantedAt), Date.parse(plant.harvestAt), now);
      if (growth.ready) void action(() => harvestPlant(plant.id), "Harvest gathered!");
      else setToast("Still growing — about " + Math.max(1, Math.ceil((Date.parse(plant.harvestAt) - now) / 1000)) + " seconds to go.");
      return;
    }
    if (state.decorations.some((item) => item.x === x && item.y === y)) { setToast("That spot has a decoration already."); return; }
    if (mode === "decorate") void action(() => placeDecoration(decoration, x, y), "A little more lovely.");
    else if ((inventory.get(speciesId)?.seeds ?? 0) > 0) void action(() => plantSeed(speciesId, x, y), "Seed planted. Come back when it blooms!");
    else { setShopOpen(true); setToast("Out of " + activeSpecies.name + " seeds — pick up a few in the seed shop."); }
  };
  const sellable = state.inventory.filter((item) => item.plants > 0);
  const finish = () => void action(() => finishTutorial(), "Tutorial complete. Your garden is yours now!");
  if (!ready) return <div className="loading-screen"><div className="loading-flower">✿</div><p>Opening your nursery…</p></div>;
  if (error && !state.playerId) return <div className="loading-screen"><div className="error-card"><span className="error-flower">🌿</span><h1>Your nursery is almost ready</h1><p>{error}</p><p className="setup-note">The game API and PostgreSQL database need to be running. See the README for the one-time setup.</p><button className="primary-button" onClick={() => { setReady(false); void refresh().catch((e: unknown) => { setError(e instanceof Error ? e.message : "Could not load the nursery."); setReady(true); }); }}>Try again</button></div></div>;
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">✿</div><div><div className="brand-name">botanical story</div><div className="brand-subtitle">your little corner of green</div></div></div>
      <div className="top-stats"><div className="stat-pill coin-pill"><span>✦</span><strong>{state.coins}</strong><small>coins</small></div><div className="stat-pill level-pill"><span>🌱</span><strong>Lv. {state.level}</strong><div className="xp-track"><i style={{ width: xpProgress + "%" }} /></div><small>{xpProgress}/100 XP</small></div><button className="round-button help-button" onClick={() => setShopOpen(true)} aria-label="Open seed shop">＋</button></div>
    </header>
    <main className="play-area">
      <NurseryCanvas plants={state.plants} decorations={state.decorations} selected={selected} now={now} onTile={onTile} />
      <div className="garden-label"><span className="sun-dot">☀</span><div><strong>Willowbrook Nursery</strong><small>Plot 01 · 20 × 20</small></div></div>
      <section className="side-panel">
        <div className="panel-head"><div><span className="eyebrow">TODAY IN YOUR GARDEN</span><h2>Your nursery</h2></div><button className="mini-button" onClick={() => void refresh()} title="Refresh garden">↻</button></div>
        <div className="quick-counts"><div><span>🌱</span><strong>{growing.length}</strong><small>growing</small></div><div><span>🧺</span><strong>{sellable.reduce((sum, item) => sum + item.plants, 0)}</strong><small>to sell</small></div><div><span>🌼</span><strong>{state.decorations.length}</strong><small>decor</small></div></div>
        <div className="mode-switch"><button className={mode === "plant" ? "active" : ""} onClick={() => setMode("plant")}>🌱 Plant</button><button className={mode === "decorate" ? "active" : ""} onClick={() => setMode("decorate")}>🪴 Decorate</button></div>
        {mode === "plant" ? <div className="seed-list"><div className="section-label">CHOOSE A SEED <button onClick={() => setShopOpen(true)}>Seed shop ↗</button></div>{SPECIES.map((species) => { const item = inventory.get(species.id); const locked = species.unlockLevel > state.level; return <button key={species.id} className={"seed-row " + (species.id === speciesId ? "selected-seed " : "") + (locked ? "locked " : "")} onClick={() => locked ? setToast("Unlocks at level " + species.unlockLevel + ".") : setSpeciesId(species.id)}><span className="seed-emoji">{species.emoji}</span><span className="seed-copy"><strong>{species.name}</strong><small>{locked ? "Unlock at level " + species.unlockLevel : Math.ceil(species.growthMs / 1000) + " sec · sell " + species.salePrice + " coins"}</small></span><span className="seed-count">×{item?.seeds ?? 0}</span></button>; })}</div> : <div className="decor-list"><div className="section-label">PICK A LITTLE DETAIL</div>{(["birdbath", "bench", "planter"] as const).map((kind) => <button key={kind} className={"decor-option " + (kind === decoration ? "chosen" : "")} onClick={() => setDecoration(kind)}><span>{kind === "birdbath" ? "⛲" : kind === "bench" ? "🪑" : "🪴"}</span><strong>{kind === "birdbath" ? "Birdbath" : kind === "bench" ? "Garden bench" : "Planter"}</strong><small>Free</small></button>)}<p className="hint-text">Tap an open patch to place your decoration.</p></div>}
        <div className="inventory-box"><div className="section-label">HARVEST BASKET <span className="basket-icon">♧</span></div>{sellable.length ? sellable.map((item) => { const plant = getSpecies(item.speciesId); return <div className="basket-row" key={item.speciesId}><span>{plant.emoji}</span><strong>{plant.name}</strong><small>×{item.plants}</small><button disabled={busy} onClick={() => void action(() => sellPlant(item.speciesId, 1), "+" + plant.salePrice + " coins · sale complete")}>Sell 1 · {plant.salePrice} ✦</button></div>; }) : <p className="empty-basket">Your first blooms will land here.</p>}</div>
      </section>
      {tutorial && <div className="tutorial-card"><div className="tutorial-icon">📖</div><div><span className="eyebrow">A LITTLE TIP</span><p>{tutorial}</p></div>{hasAnySale && <button onClick={finish} disabled={busy}>Got it</button>}</div>}
      {selected && <div className="selected-tile">Plot {selected.x + 1} · {selected.y + 1}</div>}
      {toast && <div className="toast" role="status">{toast}</div>}
      {error && state.playerId && <div className="inline-error">{error}<button onClick={() => setError("")}>×</button></div>}
      <div className="canvas-help"><span>↔ drag to move</span><span>＋ / − pinch to zoom</span></div>
    </main>
    <nav className="bottom-dock"><button className="dock-item active"><span>🌿</span><small>Nursery</small></button><button className="dock-item" onClick={() => setShopOpen(true)}><span>🛍️</span><small>Seed shop</small></button><button className="dock-item" onClick={() => setMode(mode === "plant" ? "decorate" : "plant")}><span>🪴</span><small>Decorate</small></button><div className="dock-caption"><span>✧</span> Small steps, lovely things <span>✧</span></div></nav>
    {shopOpen && <div className="modal-backdrop" onClick={() => setShopOpen(false)}><section className="shop-modal" onClick={(e) => e.stopPropagation()}><div className="shop-header"><div><span className="eyebrow">A NEW BEGINNING</span><h2>The seed shelf</h2><p>Pick a packet for your next patch.</p></div><button className="close-button" onClick={() => setShopOpen(false)}>×</button></div><div className="shop-list">{SPECIES.map((species) => { const locked = species.unlockLevel > state.level; return <div className={"shop-item " + (locked ? "shop-locked" : "")} key={species.id}><span className="shop-flower">{species.emoji}</span><div className="shop-copy"><strong>{species.name}</strong><small>{Math.ceil(species.growthMs / 1000)} sec to grow · sells for {species.salePrice} ✦</small></div><button disabled={busy || locked || state.coins < species.seedPrice} onClick={() => void action(() => buySeed(species.id), "A packet of " + species.name + " seeds is yours.")}>{locked ? "Lv. " + species.unlockLevel : "Buy · " + species.seedPrice + " ✦"}</button></div>; })}</div><div className="shop-footer"><span>Your balance</span><strong>✦ {state.coins}</strong></div></section></div>}
  </div>;
}
