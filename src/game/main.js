import { AssetLoader } from './AssetLoader.js';
import { SaveManager } from './SaveManager.js';
import { SoundManager } from './SoundManager.js';
import { UIManager } from './UIManager.js';
import { GameLoop } from './GameLoop.js';

async function bootstrap() {
  const canvas = document.getElementById('game-canvas');
  const assets = new AssetLoader();
  const saveManager = new SaveManager();
  const soundManager = new SoundManager();

  // Load assets safely (falls back to procedural vector art automatically if missing)
  await assets.loadAll();

  const uiManager = new UIManager(saveManager, soundManager, assets);
  const gameLoop = new GameLoop(canvas, assets, saveManager, soundManager, uiManager);
  uiManager.refreshMenuStats();
  gameLoop.syncLobbyBuffaloes();
  gameLoop.start();
}

window.addEventListener('DOMContentLoaded', bootstrap);
