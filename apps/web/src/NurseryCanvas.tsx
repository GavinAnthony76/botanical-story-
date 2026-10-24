import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { DecorationState, PlantState, Tile } from "@botanical-story/shared";
import { NurseryScene } from "./NurseryScene";
export default function NurseryCanvas(props: { plants: PlantState[]; decorations: DecorationState[]; selected: Tile | null; now: number; onTile: (x: number, y: number) => void }) {
  const host = useRef<HTMLDivElement>(null); const game = useRef<Phaser.Game | null>(null); const scene = useRef<NurseryScene | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const nursery = new NurseryScene(); scene.current = nursery; nursery.onTile = props.onTile;
    game.current = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, backgroundColor: "#dbe8cc", scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" }, render: { antialias: true, pixelArt: false }, scene: [nursery], input: { activePointers: 2 } });
    return () => { game.current?.destroy(true); game.current = null; scene.current = null; };
  }, []);
  useEffect(() => { if (scene.current) scene.current.onTile = props.onTile; }, [props.onTile]);
  useEffect(() => { scene.current?.setWorld({ plants: props.plants, decorations: props.decorations, selected: props.selected, now: props.now }); }, [props.plants, props.decorations, props.selected, props.now]);
  return <div className="nursery-canvas" ref={host} aria-label="Interactive isometric nursery. Drag to move; pinch or scroll to zoom." />;
}
