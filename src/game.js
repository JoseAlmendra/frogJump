// src/game.js

    class FrogJumpScene extends Phaser.Scene {
        constructor() {
            super({ key: 'FrogJumpScene' });
            this.currentFrame = 0;
            this.isJumping = false;
            this.isFalling = false;
            this.jumpHeight = 150;     // Altura máxima del salto en píxeles
            this.jumpDuration = 800;   // Duración de la subida o bajada (200ms para un salto más rápido)
            this.jumpStartTime = 0;
            this.startPosY = 0;
            this.GROUND_HEIGHT = 30; // Altura desde el borde inferior para dibujar la línea
            this.moveSpeed = 80;
            this.frameDuration = 60; // ms: VELOCIDAD DE ANIMACIÓN (60ms = rápido; 150ms = lento)
            this.frameTimer = 0;
            this.SCROLL_THRESHOLD_Y = 50;
            this.SCROLL_LOWER_THRESHOLD_Y = 200;
            this.isUp = false;
            
        }

        preload() {
            // --- ¡CORRECCIÓN CRUCIAL BASADA EN LAS DIMENSIONES REALES (60x15px)! ---
            // Ancho total del spritesheet: 60px, Alto total del spritesheet: 15px
            // frameWidth = 15px, frameHeight = 15px
            this.load.spritesheet('frog', 'assets/spritesheet.png', { frameWidth: 15, frameHeight: 15 });
            this.load.image('platform_v2', 'assets/plataform.png');
        }

        create() {
            // --- 1. CONFIGURACIÓN DEL ENTORNO ---
            this.cameras.main.setBackgroundColor('#B8F4FF'); 
            
            // --- 2. CONFIGURACIÓN DEL SUELO (Línea Negra) ---
            const lineWidth = 4;
            const lineY = this.game.config.height - this.GROUND_HEIGHT;

            this.graphics = this.add.graphics();
            this.graphics.lineStyle(lineWidth, 0x000000); 
            this.graphics.beginPath();
            this.graphics.moveTo(0, lineY);
            this.graphics.lineTo(this.game.config.width, lineY);
            this.graphics.closePath();
            this.graphics.stroke();

            this.mainGround = this.physics.add.existing(
                this.add.rectangle(
                    this.game.config.width / 2, lineY, this.game.config.width, lineWidth * 2, 0x000000, 0
                ),
                false // Objeto de física estática (inmóvil)
            );
            this.mainGround.body.setAllowGravity(false);
            this.mainGround.body.setImmovable(true); // Lo hacemos inamovible (fijo)
            this.mainGround.body.setVelocity(0, 0);

            // ----------------------------------------------------
            // 🔑 NUEVO: GRUPO DE PLATAFORMAS y GENERACIÓN
            // ----------------------------------------------------
            this.platforms = this.physics.add.group();

            // Parámetros de la Plataforma
            const platformScale = 0.08; 
            const baseColliderWidth = 860 * platformScale;
            const baseColliderHeight = 230 * platformScale;
            const colliderScaleX = 11;
            const colliderScaleY = 3;
            const offsetX = 50;
            const offsetY = 110;
            
            // Lógica de generación
            const numPlatforms = 10;
            const minSeparationY = 30; // Mínimo 30px
            const maxSeparationY = 100; // Máximo 100px
            let currentY = lineY; // Empieza desde la posición Y del suelo

            for (let i = 0; i < numPlatforms; i++) { 
                // Separación aleatoria entre 30 y 100 píxeles
                const separationY = Phaser.Math.Between(minSeparationY, maxSeparationY);
                currentY -= separationY; // Subir la posición Y

                // Posición X aleatoria, asegurando que no esté demasiado cerca del borde
                const margin = 30; 
                const minX = margin;
                const maxX = this.game.config.width - margin;
                const xPos = Phaser.Math.Between(minX, maxX);
                
                // Crear la plataforma y añadirla al grupo
                let platform = this.platforms.create(xPos, currentY, 'platform_v2');
                
                platform.body.setAllowGravity(false);
                platform.body.setImmovable(true); // Lo hacemos inamovible (fijo)
                platform.body.setVelocity(0, 0); // Le quitamos cualquier velocidad
                platform.setScale(platformScale);
                
                // Ajustes de Collider (Mantener la configuración anterior)
                platform.body.setSize(baseColliderWidth * colliderScaleX, baseColliderHeight * colliderScaleY);
                platform.body.setOffset(offsetX, offsetY);
            }


            // --- 3. CONFIGURACIÓN DE LA RANA (SPRITE) ---
            this.frog = this.physics.add.sprite(
                this.game.config.width / 2, 
                lineY,                     
                'frog'
            );
            this.frog.setOrigin(0.5, 1); 
            this.frog.setCollideWorldBounds(true);
            this.frog.setGravityY(700);     
            
            const scaleFactor = 2; 
            this.frog.setScale(scaleFactor);

            this.startPosY = this.frog.y;
            this.frog.setFrame(0); 

            // Ajustes del cuerpo de física de la rana (collider)
            this.frog.body.setSize(12, 10); 
            this.frog.body.setOffset(1.5, 5); 

            // 🔑 Estabilización Inicial: Calcular la posición Y exacta para que el body.bottom toque lineY
            const targetTopY = lineY;
            const bodyHeight = this.frog.body.height * this.frog.scaleY; 
            const bodyOffsetY = this.frog.body.offset.y * this.frog.scaleY; 
            // Posición Y del centro del sprite: Top del suelo + (mitad_de_altura_del_body) - offset_del_body
            const initialFrogY = targetTopY + (bodyHeight / 2) - bodyOffsetY;
            this.frog.y = initialFrogY;
            this.frog.body.setVelocityY(0); 
            
            // --- COLISIONES ---
            this.physics.add.collider(this.frog, this.mainGround); // Colisión simple con el suelo
            this.physics.add.collider(
                this.frog, 
                this.platforms, // Colisión con el GRUPO
                this.onPlatformCollision,
                this.canCollide.bind(this),
                this
            );

            // --- 4. ENTRADA Y UI ---
            this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.cursors = this.input.keyboard.createCursorKeys();

            this.heightText = this.add.text(10, 10, 'Estado: En suelo', { 
                fontFamily: 'Arial', 
                fontSize: '10px', 
                color: '#00ff00',
                backgroundColor: '#000000'
            });
        }

        onPlatformCollision(frog, platform) {
            // La colisión solo nos importa si la rana está cayendo (o detenida) y tocando por debajo
            if (frog.body.velocity.y > 0 && frog.body.bottom <= platform.body.top + 10) {
                // Forzamos la posición exacta de la rana sobre la plataforma
                frog.y = platform.body.top - frog.body.height / 2;
                    
                // Cancelamos cualquier velocidad vertical residual
                frog.body.setVelocityY(0);
                    
                // Opcional: un pequeño impulso negativo para "empujar" hacia la plataforma y eliminar el rebote
                frog.body.velocity.y = Math.min(frog.body.velocity.y, 0);
                    
                // Reiniciar aceleración por si acaso
                frog.body.acceleration.y = 0;
                    
                console.log(`[COLISIÓN] Aterrizaje seco en Y: ${frog.y.toFixed(2)}. V.Y: ${frog.body.velocity.y}`);
            }
        }

        update(time, delta) {
            // --- 1. MOVIMIENTO HORIZONTAL CON FLECHAS ---
            // Usa blocked.down para detectar colisión con CUALQUIER objeto colisionable
            const velocityY = this.frog.body.velocity.y;
            let scrollAmount = 0;
            let isOnGround = this.frog.body.blocked.down; 
            const numPlatforms = 10;
            console.log(`--- UPDATE INICIO --- Y: ${this.frog.y.toFixed(2)} | V.Y: ${Math.floor(velocityY)} | isUp: ${this.isUp} | OnGround: ${isOnGround}`);
            if (this.frog.y < this.SCROLL_THRESHOLD_Y) {
                
                // La cantidad a mover es la diferencia entre su posición actual y el umbral.
                // Esto siempre será un valor positivo (hacia abajo).
                scrollAmount = this.SCROLL_THRESHOLD_Y - this.frog.y;
                
                // 2. Mover la Rana al Umbral: La rana debe permanecer justo en el umbral.
                this.frog.y = this.SCROLL_THRESHOLD_Y;
                this.isUp = true;
                // 3. Mover el Entorno: Aplicar el desplazamiento a todo el entorno hacia abajo.
                
                // a) Desplazar el SUELO
                this.mainGround.y += scrollAmount;
                this.mainGround.body.updateFromGameObject();
                
                // b) Desplazar las PLATAFORMAS
                this.platforms.getChildren().forEach(platform => {
                    platform.y += scrollAmount;
                    // Esto también mueve automáticamente el cuerpo de física estática
                    platform.body.updateFromGameObject();
                });

                // c) Redibujar la línea del suelo (opcional, si quieres que se vea)
                // (Si no se redibuja, la línea solo desaparecerá al salir de la pantalla, lo cual está bien)
                this.graphics.y += scrollAmount; 

                // 4. Corregir posición de la rana (por si el physics step la empujó)
                // Es crucial para mantener la ilusión de cámara fija.
                this.frog.y = this.SCROLL_THRESHOLD_Y;
                console.log(
                    `[1. SCROLL ASCENSO ACTIVO] Y < ${this.SCROLL_THRESHOLD_Y}. Scroll: +${scrollAmount.toFixed(2)}`
                );
            }else if ((this.frog.y > this.SCROLL_LOWER_THRESHOLD_Y) && (this.isUp == true)) {
                console.log(
                `caida`
                );
                const objectsBelow = this.canSeePlatformBelowThreshold();
                if (objectsBelow < numPlatforms+1) {
                    scrollAmount = this.SCROLL_LOWER_THRESHOLD_Y - this.frog.y;
                    
                    this.frog.y = this.SCROLL_LOWER_THRESHOLD_Y;
                    console.log(
                        `[2. SCROLL DESCENSO ACTIVO] Y > ${this.SCROLL_LOWER_THRESHOLD_Y}. Scroll: ${scrollAmount.toFixed(2)} | Plataformas visibles: ${objectsBelow}`
                    );
                }else {
                     // Si no hay nada visible, el scroll de descenso termina
                     this.isUp = false; // Desactiva el control de scroll de descenso
                     console.log("[SCROLL DESCENSO DETENIDO] El suelo principal o la última plataforma han pasado el borde.");
                }
            }

            if (scrollAmount !== 0) { 
                const scrollVelocityY = scrollAmount * (1000 / delta);
                console.log(`[3. APLICANDO SCROLL] Velocidad del ambiente: ${scrollVelocityY.toFixed(2)}`);

                this.mainGround.body.setVelocityY(scrollVelocityY);
                this.platforms.getChildren().forEach((platform, index) => {
                    platform.body.setVelocityY(scrollVelocityY);

                    // El log ahora muestra la velocidad, no la Y de la plataforma
                    if (index < 3) { 
                         console.log(`   > Plataforma ${index}: Velocidad Y: ${platform.body.velocity.y.toFixed(2)}`);
                    }
                });

                this.graphics.y += scrollAmount;
                isOnGround = this.frog.body.blocked.down;

                if (!isOnGround) {
                    // Si la rana NO está en el suelo, fijamos su posición en el umbral.
                    if (scrollAmount > 0) {
                         // ✅ Caso Ascenso: FIJAR. La cámara está subiendo, la rana se queda en el umbral superior.
                         this.frog.y = this.SCROLL_THRESHOLD_Y;
                         console.log(`   > RANA FIJADA (Ascenso) a Y: ${this.SCROLL_THRESHOLD_Y}`);
                    } else {
                         // 🔑 Caso Descenso (scrollAmount < 0): NO FIJAR.
                         // Dejamos que la física controle la caída y la colisión con la plataforma en movimiento.
                         // La única corrección necesaria para el descenso se hizo en el bloque anterior (línea 224).
                         console.log(`   > RANA NO FIJADA (Descenso). La física resolverá la colisión.`); 
                    }
                } else {
                    // Si la rana colisionó (isOnGround es TRUE), la física la dejará justo en el borde.
                    // NO tocamos su Y para evitar que "despegue".
                    this.frog.body.setVelocityY(0);
                    console.log(`   > RANA **NO** FIJADA. Colisión exitosa (isOnGround es TRUE). Y: ${this.frog.y.toFixed(2)}`);
                }
            }else {
                // 3. CRÍTICO: Detener el ambiente si no hay scroll
                // Si no hay scroll, la velocidad del ambiente debe ser CERO.
                this.mainGround.body.setVelocityY(0);
                this.platforms.getChildren().forEach(platform => {
                    platform.body.setVelocityY(0);
                });
            }

            if (this.cursors.left.isDown) {
                this.frog.setVelocityX(-this.moveSpeed);
            } else if (this.cursors.right.isDown) {
                this.frog.setVelocityX(this.moveSpeed);
            } else if (isOnGround) {
                this.frog.setVelocityX(0); 
            } 

            // --- 2. Lógica de Salto (Usando Impulso de Física) ---
            const isTryingToJump = Phaser.Input.Keyboard.JustDown(this.spaceBar) || Phaser.Input.Keyboard.JustDown(this.cursors.up);

            if (isTryingToJump && isOnGround) {
                this.frog.setVelocityY(-400); // Salto con impulso
            }
            
            // --- 3. Lógica de Animación (Simple) ---
            

            if (!isOnGround) {
                if (velocityY < 0) { // Subiendo 
                    this.frameTimer += delta;
                        
                    if (this.frameTimer >= this.frameDuration) {
                        this.frameTimer = 0;

                        // Avanzamos al siguiente frame (0 -> 1 -> 2 -> 3)
                        if (this.frog.frame.name < 3) {
                            this.frog.setFrame(this.frog.frame.name + 1);
                        } else {
                            this.frog.setFrame(3); 
                        }
                    }
                } else { // Bajando
                    // Aquí se aplica la lógica de compresión de animación al caer
                    if (this.frog.frame.name !== 3) {
                       this.frog.setFrame(3); 
                    }

                    const nearestGroundY = this.findNearestGroundY();
                    const frogBottomY = this.frog.y; // Ya que origin(0.5, 1) apunta al 'bottom'
                    const distanceToGround = nearestGroundY - frogBottomY; 
                    const animationRange = 70; 
                    
                    // Lógica de compresión al caer (Frame 3 -> 2 -> 1)
                    if (distanceToGround > (animationRange * 0.66)) {
                        this.frog.setFrame(3); 
                    } else if (distanceToGround > (animationRange * 0.33)) {
                        this.frog.setFrame(2); 
                    } else if (distanceToGround > 0) {
                        this.frog.setFrame(1); 
                    }
                }
            } else {
                // En el suelo, vuelve al frame base
                this.frog.setFrame(0);
                this.isFalling = false;
                this.frameTimer = 0;
            }

            const ranaX = Math.floor(this.frog.x);
            const ranaY = Math.floor(this.frog.y);

            // --- 4. Actualización de UI ---
            let statusText = isOnGround ? 'En suelo' : 'Saltando';
            this.heightText.setText(
                `Estado: ${statusText} | V.Y: ${Math.floor(velocityY)} | Posición: (${ranaX}, ${ranaY})`
            );
            console.log(`--- UPDATE FIN --- Estado: ${statusText} | Final Y: ${this.frog.y.toFixed(2)}`);
        }

        canSeePlatformBelowThreshold() {
            // La altura de la pantalla es this.game.config.height (240 en tu caso)
            const screenHeight = this.game.config.height; 
            let visibleCount = 0;
            
            // Iteramos sobre las plataformas activas
            /*if (this.mainGround.body.top < screenHeight + 50) {
                visibleCount++;
            }*/

            for (const platform of this.platforms.getChildren()) {
                // Si el borde superior de la plataforma está visible
                if (platform.body.top < screenHeight + 50) { 
                    visibleCount++;
                }
            }

            return visibleCount;
        }

        canCollide(frog, platform) {
            // Permitir colisión SÓLO si la rana está cayendo (velocidad positiva o cero)
            if (frog.body.velocity.y >= 0) {
                 return true;
            }
            // Si va hacia arriba, permite atravesar
            return false; 
        }

        findNearestGroundY() {
            // Retorna la posición Y del borde superior del cuerpo de física más alto (menor valor Y) 
            // que esté alineado horizontalmente con la rana.
            const mainGroundTopY = this.mainGround.y;
            let nearestY = mainGroundTopY;

            this.platforms.getChildren().forEach(platform => {
                const platformBody = platform.body;
                
                // Usamos los límites del cuerpo de colisión para la comprobación X
                const isAbovePlatform = (
                    this.frog.x > platformBody.left && 
                    this.frog.x < platformBody.right
                );
                
                // Si la rana está sobre la plataforma Y la plataforma está más alta que el 'nearestY' actual, actualizamos.
                // Importante: platformBody.top es la Y donde aterrizará.
                if (isAbovePlatform && platformBody.top < nearestY) {
                    nearestY = platformBody.top;
                }
            });

            return nearestY;
        }
    }

    // Configuración principal de Phaser
    const config = {
        type: Phaser.AUTO,
        width: 320,  
        height: 240,
        render: {
            pixelArt: true 
        },
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: 'game-container'
        },
        physics: {
            default: 'arcade', 
            arcade: {
                // 🔑 Asegúrate de que esto esté en 'true' para ver los colliders de la rana y las plataformas
                debug: true 
            }
        },
        scene: FrogJumpScene
    };

    const game = new Phaser.Game(config);