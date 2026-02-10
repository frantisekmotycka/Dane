/**
 * OCR modul pro zpracování obrázků
 * Používá Tesseract.js
 */

class OCRProcessor {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
    }

    /**
     * Inicializace Tesseract worker
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log('Inicializuji Tesseract...');

            // vytvoření workeru (podpora různých verzí/CDN exportů)
            let createdWorker = null;
            try {
                if (Tesseract && typeof Tesseract.createWorker === 'function') {
                    createdWorker = Tesseract.createWorker({
                        logger: (m) => {
                            console.log(m);
                            if (m.status === 'recognizing text') {
                                const progress = Math.round(m.progress * 100);
                                this.updateProgress(progress);
                            }
                        }
                    });
                } else if (typeof createWorker === 'function') {
                    createdWorker = createWorker({
                        logger: (m) => {
                            console.log(m);
                            if (m.status === 'recognizing text') {
                                const progress = Math.round(m.progress * 100);
                                this.updateProgress(progress);
                            }
                        }
                    });
                } else {
                    throw new Error('Tesseract.createWorker není dostupný');
                }
            } catch (err) {
                console.error('Chyba při vytvoření workeru:', err);
                throw new Error('Nepodařilo se vytvořit Tesseract worker');
            }

            // Pokud createWorker vrátil Promise, počkáme na něj
            if (createdWorker && typeof createdWorker.then === 'function') {
                this.worker = await createdWorker;
            } else {
                this.worker = createdWorker;
            }

            // Některé buildy/varianty mohou vrátit již inicializovaný worker bez `load()`.
            if (this.worker && typeof this.worker.load === 'function') {
                await this.worker.load();
                await this.worker.loadLanguage('ces');
                await this.worker.initialize('ces');
            } else if (this.worker && typeof this.worker.initialize === 'function' && typeof this.worker.loadLanguage === 'function') {
                // fallback: pokud load není, ale jsou zde jiné init metody
                await this.worker.loadLanguage('ces');
                await this.worker.initialize('ces');
            } else if (this.worker && typeof this.worker.recognize === 'function') {
                // worker už může být připraven
                console.log('Worker již připraven (přeskočeno load/initialize)');
            } else {
                throw new Error('Nebylo možné inicializovat Tesseract worker - chybějící metody');
            }

            // Nastavení parametrů pro lepší rozpoznávání
            if (this.worker && typeof this.worker.setParameters === 'function') {
                await this.worker.setParameters({
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .,:-/%Kč'
                });
            }

            this.isInitialized = true;
            console.log('Tesseract inicializován s českým jazykem');
        } catch (error) {
            console.error('Chyba při inicializaci Tesseract:', error);
            throw new Error('Nepodařilo se inicializovat OCR engine. Zkuste obnovit stránku.');
        }
    }

    /**
     * Aktualizace progress baru
     */
    updateProgress(progress) {
        // Zobrazení progress v loading sekci
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            const progressText = loadingElement.querySelector('p');
            if (progressText) {
                progressText.textContent = `Zpracovávám dokument... ${progress}%`;
            }
        }
    }

    /**
     * Rozpoznání textu z obrázku
     */
    async recognizeText(imageFile) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            console.log('Spouštím OCR na obrázku:', imageFile);

            // Rozpoznání textu
            const { data } = await this.worker.recognize(imageFile);

            console.log('OCR dokončeno. Confidence:', data.confidence);
            console.log('Rozpoznaný text:', data.text);
            console.log('Délka textu:', data.text.length);

            // Pokud je text prázdný nebo velmi krátký
            if (!data.text || data.text.trim().length < 10) {
                console.warn('OCR vrátil příliš krátký text!');
                throw new Error('OCR nerozpoznal žádný text. Zkuste jiný obrázek nebo zkontrolujte kvalitu.');
            }

            return {
                text: data.text,
                confidence: data.confidence,
                words: data.words,
                lines: data.lines,
                paragraphs: data.paragraphs
            };

        } catch (error) {
            console.error('Chyba při OCR:', error);
            throw new Error('Nepodařilo se rozpoznat text z obrázku: ' + error.message);
        }
    }

    /**
     * Preprocessing obrázku pro lepší OCR
     */
    async preprocessImage(imageFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                // Nastavení velikosti canvasu
                canvas.width = img.width;
                canvas.height = img.height;

                // Vykreslení obrázku
                ctx.drawImage(img, 0, 0);

                // Získání pixel dat
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Zvýšení kontrastu a převod na grayscale
                for (let i = 0; i < data.length; i += 4) {
                    // Grayscale
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    
                    // Threshold pro binarizaci
                    const threshold = 128;
                    const value = gray > threshold ? 255 : 0;

                    data[i] = value;     // R
                    data[i + 1] = value; // G
                    data[i + 2] = value; // B
                }

                ctx.putImageData(imageData, 0, 0);

                // Převod canvasu na blob
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/png');
            };

            img.onerror = () => {
                reject(new Error('Nepodařilo se načíst obrázek'));
            };

            img.src = URL.createObjectURL(imageFile);
        });
    }

    /**
     * Cleanup - ukončení worker
     */
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
            console.log('Tesseract worker ukončen');
        }
    }
}

// Export instance
const ocrProcessor = new OCRProcessor();
