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
    }

    preload() {
        this.load.spritesheet('frog', 'assets/spritesheet.png', { frameWidth: 15, frameHeight: 15 });
        this.load.image('platform_v2', 'assets/plataform.png');
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

        const numPlatforms = 150;
        const separationY = 50; // Separación vertical fija
        const startY = 100; // Empezamos desde 100px por encima de la pantalla

        for (let i = 0; i < numPlatforms; i++) {
            let xPos = Phaser.Math.Between(0 + 50, this.game.config.width - 50); // Aleatorio dentro de los bordes
            let yPos = startY + i * separationY; // Separación fija de 200px

            let platform = this.platforms.create(xPos, yPos, 'platform_v2');
            platform.body.setAllowGravity(false);
            platform.body.setImmovable(true);
            platform.body.setVelocity(0, 0);
            platform.setScale(platformScale);

            // Mantener la relación exacta del collider del original
            platform.body.setSize(baseColliderWidth * colliderScaleX, baseColliderHeight * colliderScaleY);
            platform.body.setOffset(offsetX, offsetY);
        }

        let firstPlatform = this.platforms.getChildren()[140];
        this.frog = this.physics.add.sprite(firstPlatform.x, firstPlatform.y - 10, 'frog');
        this.frog.setFrame(0);
        this.frog.setOrigin(0.5, 1);

        this.frog.setDisplaySize(this.frog.width * 2, this.frog.height * 2);
        
        this.frog.body.setSize(7.5, 9); 
        this.frog.body.setOffset(3.51, 5);
        this.frog.body.setAllowGravity(true);
        this.frog.body.setGravityY(700); // caida natural
        this.frog.body.setBounce(0);
        this.frog.y = firstPlatform.y;
        this.frog.isFrozen = false;

        // Controles de teclado
        this.cursors = this.input.keyboard.createCursorKeys();

        this.physics.add.collider(this.frog, this.platforms, (frog ,platform) => {
            if (frog.body.velocity.y > 0 && frog.body.bottom <= platform.body.top + 1) {
                frog.body.setVelocityY(0);
                frog.y = platform.body.top - frog.body.height / 2;
            }
        });

        this.prevFrogX = this.frog.x;
        this.prevFrogY = this.frog.y;
        
        // Supongamos que queremos que la rana aparezca en la plataforma 9
        let targetPlatformIndex = 140;
        let targetPlatform = this.platforms.getChildren()[targetPlatformIndex];

        // Calculamos el offset para que la rana esté visible en pantalla
        let screenY = 180; // posición vertical donde quieres que la rana aparezca
        offsetY = screenY - targetPlatform.y;

        // Aplicamos el offset a todas las plataformas y a la rana
        this.platforms.getChildren().forEach(platform => {
            platform.y += offsetY;
            platform.body.updateFromGameObject();
        });

        this.frog.y += offsetY;
        this.prevFrogY = this.frog.y;
        this.randomYplataform = Math.floor(5 + Math.random() * 46);
    }
    update() {
        //console.log(`[DIAG] Frog Y Global: ${this.frog.y.toFixed(2)} | Frog Vel Y: ${this.frog.body.velocity.y.toFixed(2)}`);
        const speed = 100; // Velocidad horizontal de la rana

        if (this.cursors.left.isDown) {
            this.frog.setVelocityX(-speed);
            this.frog.flipX = true; // Voltear la rana si quieres que mire a la izquierda
        } else if (this.cursors.right.isDown) {
            this.frog.setVelocityX(speed);
            this.frog.flipX = false; // Mira a la derecha
        } else {
            this.frog.setVelocityX(0);
        }

        if (this.cursors.up.isDown && this.frog.body.blocked.down) {
            this.frog.setVelocityY(-400); // ajusta para que suba ~100px
            let frameIndex = 0;
            const frameTimer = this.time.addEvent({
                delay: 50, // ms entre frames
                repeat: 3, // 4 frames en total (0 a 3)
                callback: () => {
                    this.frog.setFrame(frameIndex);
                    frameIndex++;
                }
            });
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
                    console.log(`Jugador cayendo en plataforma ${index}`);
                    this.lastPlatform = index;
                    // Activar colisión solo si el jugador está por encima
                    platform.body.checkCollision.up = true; // colisiona desde arriba
                    let frameIndex = 3;
                    this.time.addEvent({
                        delay: 15,
                        repeat: 3,
                        callback: () => {
                            this.frog.setFrame(frameIndex);
                            frameIndex--;
                        }
                    });
                } else {
                    // Permitir atravesar la plataforma si no está cayendo sobre ella
                    platform.body.checkCollision.up = false;
                    platform.body.checkCollision.down = false;
                }
            });
        }
        if (this.skipScrollThisFrame) {
            this.skipScrollThisFrame = false;
            return; // 🔴 detiene el update temporalmente
        }
        if (this.frog.x !== this.prevFrogX || this.frog.y !== this.prevFrogY) {
            //console.log(`Frog X: ${this.frog.x.toFixed(2)}, Y: ${this.frog.y.toFixed(2)}`);
            this.prevFrogX = this.frog.x;
            this.prevFrogY = this.frog.y;
        }

        if (this.frog.y > 180) {
            if (!this.frog.isFrozen) {
                console.log("subir plataformas");
                this.frog.isFrozen = true; // marca que ya está en la zona congelada
            }
            // Limitar caída solo si va hacia abajo
            
            if (this.frog.body.velocity.y > 0) {
                this.frog.body.setGravityY(100);
                this.frog.body.setVelocityY(0);
                this.platforms.getChildren().forEach(platform => {
                    platform.y -= 2.3;
                    platform.body.updateFromGameObject(); // importante para actualizar colider
                });
            }

        } else if(this.frog.y < 50){
            this.conterPlataform += -this.frog.body.deltaY();
            //console.warn(`[SCROLL] Contador de Scroll: ${this.conterPlataform.toFixed(2)} | Random Trigger: ${this.randomYplataform}`);
            if (this.frog.body.velocity.y < 0) {
                const scrollFactor = 0.8;
                const scrollSpeed = -this.frog.body.velocity.y * scrollFactor * this.game.loop.delta / 1000;
                //console.warn(`[SCROLL] Velocidad de Plataforma aplicada: ${scrollSpeed.toFixed(2)}`);
                this.platforms.getChildren().forEach(platform => {
                    platform.y += scrollSpeed;
                    platform.body.updateFromGameObject();
                });
            
                // mantener a la rana fija visualmente en la parte alta
                this.frog.y = 50;
            }
            
            /*if (this.frog.body.velocity.y < 0 && this.lastPlatform<=10){
                console.log(`contador para mover la plataforma ${this.conterPlataform} - ${this.randomYplataform}`);
                
                if(this.conterPlataform >= this.randomYplataform){
                    let platformsArray = this.platforms.getChildren(); 
                    let highestY = platformsArray[0].y; // Referencia de Y de la Plataforma 0 (la más alta)
                    let lowestY = -Infinity;
                    let platformToRecycle = null;

                    platformsArray.forEach(platform => {
                        if (platform.y > lowestY) {
                            lowestY = platform.y;
                            platformToRecycle = platform;
                        }
                    });

                    if (platformToRecycle && lowestY > this.game.config.height + 50) {
                    
                        // Queremos que esté 50px arriba de la plataforma más alta (firstPlatform/highestY)
                        const separation = 50; 
                        let newY = highestY - separation; 
                        
                        // === 3. APLICAR EL RECICLAJE ===
                        platformToRecycle.y = newY; 
                        platformToRecycle.x = Phaser.Math.Between(50, this.game.config.width - 50);
                        platformToRecycle.body.updateFromGameObject();
                        
                        console.log(`[RECICLAJE] Plataforma reciclada. De Y=${lowestY.toFixed(2)} a Nueva Y=${newY.toFixed(2)}`);
                        
                    } else {
                        console.log(`[RECICLAJE OMITIDO] Lowest Y (${lowestY.toFixed(2)}) aún visible o no es hora.`);
                    }
                    this.randomYplataform = Math.floor(5 + Math.random() * 46);
                    this.conterPlataform=0;
                }

            }*/
            if (this.frog.body.velocity.y < 0 && this.lastPlatform==0){
                console.log("→ Reciclando plataforma 29 sobre la 0");

                this.time.delayedCall(16, () => {
                    const platformsArray = this.platforms.getChildren();
                    const platform0 = platformsArray[0];
                    const platform29 = platformsArray[29];

                    const separation = 50;
                    const newY = platform0.y - separation;
                    const newX = Phaser.Math.Between(50, this.game.config.width - 50);

                    platform29.setPosition(newX, newY);
                    platform29.body.updateFromGameObject();

                    console.log(`[RECICLAJE] Plataforma 29 → X=${newX.toFixed(1)}, Y=${newY.toFixed(1)}`);

                    this.lastPlatform += 1;

                    // Evita que el scroll mueva esta plataforma inmediatamente
                    this.skipScrollThisFrame = true;

                    let arr = this.platforms.getChildren();
                    const moved = arr.pop();
                    arr.unshift(moved);
                    // Permite reciclar nuevamente después de un breve tiempo
                    this.time.delayedCall(100, () => { this.waitingRecycle = false; });
                    
                });

                this.lastPlatform += 1;

                // Evitar que el scroll mueva esta plataforma inmediatamente
                this.skipScrollThisFrame = true;

            }
        }else {
            // Si la rana sube por alguna razón, desactivar congelamiento
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
    physics: { default: 'arcade', arcade: { debug: true } },
    scene: FrogJumpScene
};

const game = new Phaser.Game(config);
