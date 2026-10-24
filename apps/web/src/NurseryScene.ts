import Phaser from "phaser";
import type { DecorationState, PlantState, Tile } from "@botanical-story/shared";
import { getSpecies } from "@botanical-story/game-data";
import { growthState } from "@botanical-story/game-core";

const TILE_W = 70;
const TILE_H = 36;
export interface NurseryWorld { plants: PlantState[]; decorations: DecorationState[]; selected?: Tile | null; now: number }
export class NurseryScene extends Phaser.Scene {
  onTile?: (x: number, y: number) => void;
  private world: NurseryWorld = { plants: [], decorations: [], now: Date.now() };
  private layer?: Phaser.GameObjects.Container;
  private lastPointer?: { x: number; y: number };
  private dragged = false;
  private pinchDistance = 0;
  constructor() { super("NurseryScene"); }
  create() {
    this.cameras.main.setBackgroundColor("#dbe8cc");
    this.cameras.main.setBounds(0, 0, 1500, 920);
    this.cameras.main.centerOn(750, 430);
    this.cameras.main.setZoom(0.78);
    this.input.addPointer(1);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { this.lastPointer = { x: pointer.x, y: pointer.y }; this.dragged = false; });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const active = this.input.manager.pointers.filter((item) => item.isDown);
      if (active.length > 1) {
        const distance = Phaser.Math.Distance.Between(active[0].x, active[0].y, active[1].x, active[1].y);
        if (this.pinchDistance > 0 && distance > 0) this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * distance / this.pinchDistance, 0.48, 1.25));
        this.pinchDistance = distance; this.lastPointer = undefined; this.dragged = true; return;
      }
      if (pointer.isDown && this.lastPointer) {
        const dx = pointer.x - this.lastPointer.x; const dy = pointer.y - this.lastPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) this.dragged = true;
        if (this.dragged) { this.cameras.main.scrollX -= dx / this.cameras.main.zoom; this.cameras.main.scrollY -= dy / this.cameras.main.zoom; }
        this.lastPointer = { x: pointer.x, y: pointer.y };
      }
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragged && this.lastPointer) { const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); const tile = this.tileAt(point.x, point.y); if (tile) this.onTile?.(tile.x, tile.y); }
      this.lastPointer = undefined; this.pinchDistance = 0;
    });
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.48, 1.25)));
    this.renderWorld();
  }
  setWorld(world: NurseryWorld) { this.world = world; if (this.scene?.isActive()) this.renderWorld(); }
  private center(x: number, y: number) { return { x: 750 + (x - y) * TILE_W / 2, y: 65 + (x + y) * TILE_H / 2 }; }
  private tileAt(worldX: number, worldY: number): Tile | null {
    const px = worldX - 750; const py = worldY - 65;
    const x = Math.round(px / TILE_W + py / TILE_H); const y = Math.round(py / TILE_H - px / TILE_W);
    return x >= 0 && y >= 0 && x < 20 && y < 20 ? { x, y } : null;
  }
  private renderWorld() {
    this.layer?.destroy(true); this.layer = this.add.container(0, 0);
    const ground = this.add.graphics(); this.layer.add(ground);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const p = this.center(x, y); const selected = this.world.selected?.x === x && this.world.selected?.y === y;
      ground.fillStyle(selected ? 0xf4d98a : ((x + y) % 2 ? 0x91bd77 : 0x9bc580), selected ? 0.95 : 1);
      ground.lineStyle(selected ? 3 : 1, selected ? 0xf4a54d : 0x7ca76a, selected ? 0.95 : 0.6);
      ground.beginPath(); ground.moveTo(p.x, p.y - TILE_H / 2); ground.lineTo(p.x + TILE_W / 2, p.y); ground.lineTo(p.x, p.y + TILE_H / 2); ground.lineTo(p.x - TILE_W / 2, p.y); ground.closePath(); ground.fillPath(); ground.strokePath();
    }
    for (const decoration of this.world.decorations) {
      const p = this.center(decoration.x, decoration.y); const icon = decoration.kind === "birdbath" ? "⛲" : decoration.kind === "bench" ? "🪑" : "🪴";
      this.layer.add(this.add.text(p.x, p.y - 14, icon, { fontSize: "25px" }).setOrigin(0.5));
    }
    for (const plant of this.world.plants) {
      if (plant.status !== "growing") continue;
      const p = this.center(plant.x, plant.y); const species = getSpecies(plant.speciesId);
      const growth = growthState(Date.parse(plant.plantedAt), Date.parse(plant.harvestAt), this.world.now);
      const pot = this.add.graphics(); pot.fillStyle(0x9b6543, 1); pot.fillEllipse(p.x, p.y + 4, 28, 12); pot.fillStyle(0xc48a58, 1); pot.fillRoundedRect(p.x - 10, p.y - 1, 20, 12, 3);
      this.layer.add(pot);
      const mark = growth.stage === 0 ? "·" : growth.stage === 1 ? "🌱" : growth.stage === 2 ? species.emoji : species.emoji;
      const text = this.add.text(p.x, p.y - (growth.stage === 3 ? 29 : 24), mark, { fontSize: growth.stage >= 2 ? "25px" : "22px", shadow: { color: "#36533b", blur: 4, fill: true, offsetX: 0, offsetY: 2 } }).setOrigin(0.5);
      this.layer.add(text);
      if (growth.ready) this.layer.add(this.add.text(p.x, p.y - 49, "✦", { fontSize: "15px", color: "#fff4b0" }).setOrigin(0.5));
    }
  }
}
