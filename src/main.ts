import Phaser from 'phaser';
import MenuScene        from './scenes/MenuScene';
import GameScene        from './scenes/GameScene';
import ShopScene        from './scenes/ShopScene';
import LeaderboardScene from './scenes/LeaderboardScene';
import SoundtrackScene  from './scenes/SoundtrackScene';
import EndGameScene     from './scenes/EndGameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 640,
  backgroundColor: '#0f172a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 900 },
      debug: false,
    },
  },
  scene: [MenuScene, GameScene, ShopScene, LeaderboardScene, SoundtrackScene, EndGameScene],
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
