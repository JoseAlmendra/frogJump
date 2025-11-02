// src/game.js

class FrogJumpScene extends Phaser.Scene {
    constructor() {
        super({ key: 'FrogJumpScene' });
        this.currentFrame = 0;
        this.isJumping = false;
        this.isFalling = false;
        this.jumpHeight = 150;
        this.jumpDuration = 800;
        this.jumpStartTime = 0;
        this.startPosY = 0;
        this.GROUND_HEIGHT = 30;
        this.moveSpeed = 80;
        this.frameDuration = 60;
        this.frameTimer = 0;
        this.SCROLL_THRESHOLD_Y = 50;
        this.SCROLL_LOWER_THRESHOLD_Y = 200;
        this.isUp = false;
        this.lastPlatform = 0;
        this.conterPlataform = 0;
        this.randomYplataform = 0;
        this.waitingRecycle = false;

        this.initialTime = 40; // 40 segundos
        this.timeRemaining = this.initialTime;
        this.timerText = null;
        this.timedEvent = null;
    }

    preload() {
        this.load.spritesheet('frog', 'assets/spritesheet.png', { frameWidth: 15, frameHeight: 15 });
        this.load.image('platform_v2', 'assets/plataform.png');
        this.load.image('key', 'assets/key.png');
    }

    create() {
        this.cameras.main.setBackgroundColor('#B8F4FF');
        const lineY = this.game.config.height - this.GROUND_HEIGHT;

        // Plataforma única
        this.platforms = this.physics.add.group();

        const platformScale = 0.08;
        const baseColliderWidth = 860 * platformScale;
        const baseColliderHeight = 230 * platformScale;
        const colliderScaleX = 11;
        const colliderScaleY = 3;
        const offsetX = 50;
        let offsetY = 110;

        const numPlatforms = 22;
        const separationY = 50; // Separación vertical fija
        const initialY = this.game.config.height - 50; // Y de la plataforma 0.

        for (let i = 0; i < numPlatforms; i++) {
            let xPos = Phaser.Math.Between(0 + 50, this.game.config.width - 50);
            
            // Generación de abajo hacia arriba
            let yPos = initialY - i * separationY; 

            let platform = this.platforms.create(xPos, yPos, 'platform_v2');
            platform.body.setAllowGravity(false);
            platform.body.setImmovable(true);
            platform.body.setVelocity(0, 0);
            platform.setScale(platformScale);

            // Configuramos solo el COLLIDER SUPERIOR para que se pueda atravesar
            platform.body.checkCollision.down = false;
            platform.body.checkCollision.left = false;
            platform.body.checkCollision.right = false;

            platform.body.setSize(baseColliderWidth * colliderScaleX, baseColliderHeight * colliderScaleY);
            platform.body.setOffset(offsetX, offsetY);

            if (i === numPlatforms - 1) {
                this.lastPlatformGenerated = platform;
            }
        }

        let firstPlatform = this.platforms.getChildren()[0];
        this.frog = this.physics.add.sprite(firstPlatform.x, firstPlatform.y - 10, 'frog');
        this.frog.setFrame(0);
        this.frog.setOrigin(0.5, 1);

        this.frog.setDisplaySize(this.frog.width * 2, this.frog.height * 2);
        
        // AJUSTE CRÍTICO: Aseguramos el contacto vertical para que 'blocked.down' funcione
        this.frog.body.setSize(8, 8); 
        this.frog.body.setOffset(3.5, 6);
        
        this.frog.body.setAllowGravity(true);
        this.frog.body.setGravityY(700); 
        this.frog.body.setBounce(0);
        this.frog.y = firstPlatform.y;
        this.frog.isFrozen = false;

        // Controles de teclado
        this.cursors = this.input.keyboard.createCursorKeys();
        let xPos = Phaser.Math.Between(0 + 50, this.game.config.width - 50);
        this.key = this.physics.add.sprite(
            Phaser.Math.Between(0 + 50, this.game.config.width - 50),
            this.lastPlatformGenerated.y - 90,
            'key'
        );
        this.key.body.setAllowGravity(false);  // no cae
        this.key.body.setImmovable(true);      // no se mueve por colisiones
        const keyScale = (860 * 0.05) / 250 * 0.5; // el *0.5 es opcional, ajustar tamaño
        this.key.setScale(keyScale);
        this.key.body.setSize(250, 120);
        // Detectar cuando la rana recoge la llave
        this.physics.add.overlap(this.frog, this.key, (frog, key) => {
            console.log("¡Has recogido la llave!");
            key.destroy();
            this.key = null;
            if (this.timedEvent) {
                this.timedEvent.paused = true;
            }
        });

        // LÓGICA DE COLISIÓN CORREGIDA: Fuerza el aterrizaje si viene cayendo
        this.physics.add.collider(this.frog, this.platforms, (frog, platform) => {
            // Solo si está cayendo y la parte inferior de la rana está encima del 'top' de la plataforma
            if (frog.body.velocity.y > 0 && frog.body.bottom <= platform.body.top + 5) {
                frog.body.setVelocityY(0);
                frog.y = platform.body.top; // Ajuste fino para la posición
                frog.body.blocked.down = true; // Forzamos el estado de "en tierra"
            }
        });
        
        this.timeRemaining = 10; // 40 segundos
        this.timerText = this.add.dom(
            this.game.config.width / 2,
            3,
            'div',
             `
            font-family: Digital-7;
            font-size: 15px;
            color: #ff0000;
            text-align: center;
            background-color: black;    /* Fondo negro */
            border: 1.5px solid #888888; /* Borde gris */
            padding: 4px 8px;           /* Espaciado interno */
            display: inline-block;
            `,
            this.formatTime(this.timeRemaining)
        );
        this.timerText.setOrigin(0.5, 0);

        // Evento que resta 1 segundo cada 1000 ms
        this.timedEvent = this.time.addEvent({
            delay: 1000,
            callback: this.onSecond,
            callbackScope: this,
            loop: true
        });

        this.prevFrogX = this.frog.x;
        this.prevFrogY = this.frog.y;
        
        this.randomYplataform = Math.floor(5 + Math.random() * 46);

        const graphics = this.add.graphics();
        graphics.fillStyle(0xff0000, 1);  // color rojo
        graphics.fillCircle(2, 2, 2);     // círculo de radio 2px
        graphics.generateTexture('redParticle', 4, 4); // crea textura 4x4
        graphics.destroy(); // ya no necesitamos el gráfico
    }
    onSecond() {
        this.timeRemaining--;
        this.timerText.setText(this.formatTime(this.timeRemaining));

        if (this.timeRemaining <= 0) {
            this.timedEvent.remove();
            this.explodeFrog();
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const partInSeconds = seconds % 60;
        const formattedSeconds = partInSeconds.toString().padStart(2, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');
        return `${formattedMinutes}:${formattedSeconds}`;
    }

    explodeFrog() {
        // Ocultamos la rana
        this.frog.setVisible(false);
        this.frog.body.enable = false;

        const numParticles = 50;
        const redParticles = [];
        const greenParticles = [];
        
        for (let i = 0; i < numParticles; i++) {
            // Creamos un pequeño círculo rojo con graphics
            const p = this.add.circle(this.frog.x, this.frog.y-10, 2, 0xff0000);
            // Le damos velocidad inicial aleatoria
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.Between(100, 200);
            redParticles.push({
                gameObject: p,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Phaser.Math.Between(300, 600) // ms
            });
        }
        for (let i = 0; i < 80 / 2; i++) { // menos cantidad
            const p = this.add.circle(this.frog.x, this.frog.y - 10, 2.5, 0xb5e549);
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.Between(50, 300); // un poco más rápidas
            greenParticles.push({
                gameObject: p,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Phaser.Math.Between(400, 700)
            });
        }
        // Animación de partículas
        const startTime = this.time.now;
        this.events.on('update', function updateParticles(time, delta) {
            let alive = false;
            const allParticles = [...redParticles, ...greenParticles];
            for (let part of allParticles) {
                if (part.life > 0) {
                    alive = true;
                    // Actualizamos posición
                    part.gameObject.x += part.vx * (delta / 1000);
                    part.gameObject.y += part.vy * (delta / 1000);
                    // Aplica gravedad
                    part.vy += 300 * (delta / 1000);
                    // Disminuye la vida
                    part.life -= delta;
                    // Desvanece
                    part.gameObject.alpha = Math.max(part.life / 700, 0);
                } else {
                    part.gameObject.destroy();
                }
            }
            if (!alive) {
                // Cuando todas mueren, quitamos el listener
                this.events.off('update', updateParticles, this);
            }
        }, this);
    }

    update() {
        const speed = 100; // Velocidad horizontal de la rana

        if (this.cursors.left.isDown) {
            this.frog.setVelocityX(-speed);
            this.frog.flipX = true; 
        } else if (this.cursors.right.isDown) {
            this.frog.setVelocityX(speed);
            this.frog.flipX = false; 
        } else {
            this.frog.setVelocityX(0);
        }

        // EL SALTO AHORA DEBE FUNCIONAR PORQUE 'blocked.down' SE ESTABLECIÓ EN EL COLLIDER
        if (this.cursors.up.isDown && this.frog.body.blocked.down) {
            this.frog.setVelocityY(-400); 
            // Lógica de animación de salto...
            let frameIndex = 0;
            this.time.addEvent({
                delay: 50, 
                repeat: 3, 
                callback: () => {
                    this.frog.setFrame(frameIndex);
                    frameIndex++;
                }
            });
        }
        
        // ELIMINACIÓN DE LA LÓGICA MANUAL DE COLISIÓN (Causaba el conflicto)
        
        if (this.skipScrollThisFrame) {
            this.skipScrollThisFrame = false;
            return; 
        }
        if (this.frog.x !== this.prevFrogX || this.frog.y !== this.prevFrogY) {
            this.prevFrogX = this.frog.x;
            this.prevFrogY = this.frog.y;
        }

        if (this.frog.body.velocity.y > 0) {
            this.platforms.getChildren().forEach((platform, index) => {
                const player = this.frog;

                const platformLeft = platform.body.x;
                const platformRight = platform.body.x + platform.body.width;
                const platformTop = platform.body.y;
                const detectionHeight = 90;

                const detectionTop = platformTop - detectionHeight;
                const detectionBottom = platformTop;

                const playerBottom = player.body.y + player.body.height;
                const playerTop = player.body.y;
                const playerLeft = player.body.x;
                const playerRight = player.body.x + player.body.width;

                // Comprobamos si el jugador está dentro del rango horizontal y vertical
                const isAbovePlatform = 
                    playerRight > platformLeft &&
                    playerLeft < platformRight &&
                    playerBottom > detectionTop &&
                    playerTop < detectionBottom &&
                    player.body.velocity.y > 0;

                if (isAbovePlatform) {
                    // console.log(`Jugador cayendo en plataforma ${index}`);
                    this.lastPlatform = index;
                    let frameIndex = 3;
                    this.time.addEvent({
                        delay: 15,
                        repeat: 3,
                        callback: () => {
                            this.frog.setFrame(frameIndex);
                            frameIndex--;
                        }
                    });
                    

                }
            });
        }

        // LÓGICA DE CAÍDA LENTA (Parte inferior de la pantalla)
        if (this.frog.y > 180) {
            if (!this.frog.isFrozen) {
                this.frog.isFrozen = true; 
            }
            
            if (this.frog.body.velocity.y > 0) {
                this.frog.body.setGravityY(100);
                this.frog.body.setVelocityY(0);
                this.platforms.getChildren().forEach(platform => {
                    platform.y -= 2.3;
                    platform.body.updateFromGameObject(); 
                });
                if (this.key) {
                    this.key.y -= 2.3;
                }
            }

        } 
        
        // LÓGICA DE SCROLL (Parte superior de la pantalla)
        else if(this.frog.y < 60){
            this.conterPlataform += -this.frog.body.deltaY();
            
            if (this.frog.body.velocity.y < 0) {
                const scrollFactor = 0.8;
                const scrollSpeed = -this.frog.body.velocity.y * scrollFactor * this.game.loop.delta / 1000;
                
                this.platforms.getChildren().forEach(platform => {
                    platform.y += scrollSpeed;
                    platform.body.updateFromGameObject();
                });
                if (this.key) {
                    this.key.y += scrollSpeed;
                    this.key.body.updateFromGameObject(); // actualiza el cuerpo
                }
                this.frog.y = 60;
            }
            
        

        } else {
            // Estado normal
            this.frog.isFrozen = false;
            this.frog.body.setGravityY(700);
        }
    }
}

// Configuración Phaser
const config = {
    type: Phaser.AUTO,
    width: 320,
    height: 240,
    render: { pixelArt: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'game-container' },
    physics: { default: 'arcade', arcade: { debug: false } },
    dom: {
        createContainer: true
    },
    scene: FrogJumpScene
};

const game = new Phaser.Game(config);