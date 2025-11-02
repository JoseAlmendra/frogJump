// src/game.js

class FrogJumpScene extends Phaser.Scene {
    constructor() {
        super({ key: 'FrogJumpScene' });
        this.currentFrame = 0;
        this.jumpHeight = 150;
        this.jumpDuration = 800;
        this.GROUND_HEIGHT = 30;
        this.moveSpeed = 80;
        this.frameDuration = 60;
        this.frameTimer = 0;
        this.SCROLL_THRESHOLD_Y = 50;
        this.SCROLL_LOWER_THRESHOLD_Y = 200;
        this.isUp = false;
    }

    preload() {
        this.load.spritesheet('frog', 'assets/spritesheet.png', { frameWidth: 15, frameHeight: 15 });
        this.load.image('platform_v2', 'assets/plataform.png');
    }

    create() {
        // Fondo
        this.cameras.main.setBackgroundColor('#B8F4FF');

        // Suelo
        const lineWidth = 4;
        const lineY = this.game.config.height - this.GROUND_HEIGHT;

        this.graphics = this.add.graphics();
        this.graphics.lineStyle(lineWidth, 0x000000);
        this.graphics.beginPath();
        this.graphics.moveTo(0, lineY);
        this.graphics.lineTo(this.game.config.width, lineY);
        this.graphics.stroke();

        this.mainGround = this.physics.add.existing(
            this.add.rectangle(this.game.config.width / 2, lineY, this.game.config.width, lineWidth * 2),
            false
        );
        this.mainGround.body.setAllowGravity(false);
        this.mainGround.body.setImmovable(true);

        // Plataformas
        this.platforms = this.physics.add.group();
        const platformScale = 0.08;
        const baseColliderWidth = 860 * platformScale;
        const baseColliderHeight = 230 * platformScale;
        const colliderScaleX = 11;
        const colliderScaleY = 3;
        const offsetX = 50;
        const offsetY = 110;

        const numPlatforms = 10;
        this.numPlatforms = numPlatforms;
        const minSeparationY = 30;
        const maxSeparationY = 100;
        let currentY = lineY;

        for (let i = 0; i < numPlatforms; i++) {
            const separationY = Phaser.Math.Between(minSeparationY, maxSeparationY);
            currentY -= separationY;
            const margin = 30;
            const xPos = Phaser.Math.Between(margin, this.game.config.width - margin);
            let platform = this.platforms.create(xPos, currentY, 'platform_v2');
            platform.body.setAllowGravity(false);
            platform.body.setImmovable(true);
            platform.setScale(platformScale);
            platform.body.setSize(baseColliderWidth * colliderScaleX, baseColliderHeight * colliderScaleY);
            platform.body.setOffset(offsetX, offsetY);
        }

        // Rana
        this.frog = this.physics.add.sprite(this.game.config.width / 2, lineY, 'frog');
        this.frog.setOrigin(0.5, 1);
        this.frog.setCollideWorldBounds(true);
        this.frog.setGravityY(700);
        this.frog.setScale(2);
        this.frog.setFrame(0);
        this.frog.body.setSize(12, 10);
        this.frog.body.setOffset(1.5, 5);

        // Ajuste inicial de la posición
        const bodyHeight = this.frog.body.height * this.frog.scaleY;
        const bodyOffsetY = this.frog.body.offset.y * this.frog.scaleY;
        this.frog.y = lineY + bodyHeight / 2 - bodyOffsetY;
        this.frog.body.setVelocityY(0);

        // Colisiones
        this.physics.add.collider(this.frog, this.mainGround, this.onPlatformCollision, null, this);
        this.physics.add.collider(this.frog, this.platforms, this.onPlatformCollision, this.canCollide.bind(this), this);

        // Entrada
        this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.cursors = this.input.keyboard.createCursorKeys();

        this.heightText = this.add.text(10, 10, 'Estado: En suelo', { fontFamily: 'Arial', fontSize: '10px', color: '#00ff00', backgroundColor: '#000000' });
    }

    onPlatformCollision(frog, platform) {
        // Solo si la rana cae sobre la plataforma desde arriba
        if (frog.body.velocity.y > 0 && frog.body.bottom <= platform.body.top + 10) {
            frog.body.setVelocityY(0);
            frog.y = platform.body.top; // Ajusta la rana justo encima
            this.isFalling = false;
            this.frameTimer = 0;
        }
    }

    canCollide(frog, platform) {
        return frog.body.velocity.y >= 0;
    }

    update(time, delta) {
        const velocityY = this.frog.body.velocity.y;
        let scrollAmount = 0;
        let isOnGround = this.frog.body.blocked.down || this.frog.body.touching.down;

        // Scroll ascendente
        if (this.frog.y < this.SCROLL_THRESHOLD_Y) {
            scrollAmount = this.SCROLL_THRESHOLD_Y - this.frog.y;
            this.frog.y = this.SCROLL_THRESHOLD_Y;
            this.isUp = true;

            this.mainGround.y += scrollAmount;
            this.mainGround.body.updateFromGameObject();

            this.platforms.getChildren().forEach(platform => {
                platform.y += scrollAmount;
                platform.body.updateFromGameObject();
            });

            this.graphics.y += scrollAmount;
        }

        // Scroll descendente
        else if (this.frog.y > this.SCROLL_LOWER_THRESHOLD_Y && this.isUp) {
            const visiblePlatforms = this.platforms.getChildren().filter(p => p.body.top < this.game.config.height + 50).length;
            if (visiblePlatforms < this.numPlatforms + 1) {
                scrollAmount = this.SCROLL_LOWER_THRESHOLD_Y - this.frog.y;
                this.frog.y = this.SCROLL_LOWER_THRESHOLD_Y;
            } else {
                this.isUp = false;
            }
        }

        // Aplicar scroll
        if (scrollAmount !== 0) {
            const scrollVelocityY = scrollAmount * (1000 / delta);
            this.mainGround.body.setVelocityY(scrollVelocityY);
            this.platforms.getChildren().forEach(platform => {
                platform.body.setVelocityY(scrollVelocityY);
            });
            this.graphics.y += scrollAmount;
        } else {
            this.mainGround.body.setVelocityY(0);
            this.platforms.getChildren().forEach(platform => platform.body.setVelocityY(0));
        }

        // Movimiento horizontal
        if (this.cursors.left.isDown) this.frog.setVelocityX(-this.moveSpeed);
        else if (this.cursors.right.isDown) this.frog.setVelocityX(this.moveSpeed);
        else if (isOnGround) this.frog.setVelocityX(0);

        // Salto
        const isTryingToJump = Phaser.Input.Keyboard.JustDown(this.spaceBar) || Phaser.Input.Keyboard.JustDown(this.cursors.up);
        if (isTryingToJump && isOnGround) {
            this.frog.setVelocityY(-400);
        }

        // Animación
        if (!isOnGround) {
            if (velocityY < 0) { // Subiendo
                this.frameTimer += delta;
                if (this.frameTimer >= this.frameDuration) {
                    this.frameTimer = 0;
                    if (this.frog.frame.name < 3) this.frog.setFrame(this.frog.frame.name + 1);
                    else this.frog.setFrame(3);
                }
            } else { // Bajando
                const nearestY = this.findNearestGroundY();
                const dist = nearestY - this.frog.y;
                if (dist > 46) this.frog.setFrame(3);
                else if (dist > 23) this.frog.setFrame(2);
                else if (dist > 0) this.frog.setFrame(1);
            }
        } else {
            this.frog.setFrame(0);
            this.isFalling = false;
            this.frameTimer = 0;
        }

        // UI
        let statusText = isOnGround ? 'En suelo' : 'Saltando';
        this.heightText.setText(`Estado: ${statusText} | V.Y: ${Math.floor(velocityY)} | Posición: (${Math.floor(this.frog.x)}, ${Math.floor(this.frog.y)})`);
    }

    findNearestGroundY() {
        let nearestY = this.mainGround.y;
        this.platforms.getChildren().forEach(platform => {
            const body = platform.body;
            if (this.frog.x > body.left && this.frog.x < body.right && body.top < nearestY) nearestY = body.top;
        });
        return nearestY;
    }
}

// Configuración Phaser
const config = {
    type: Phaser.AUTO,
    width: 320,
    height: 240,
    render: { pixelArt: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'game-container' },
    physics: { default: 'arcade', arcade: { debug: true } },
    scene: FrogJumpScene
};

const game = new Phaser.Game(config);
