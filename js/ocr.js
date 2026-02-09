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
            
            this.worker = await Tesseract.createWorker({
                logger: (m) => {
                    console.log(m);
                    // Můžeme zde zobrazit progress bar
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        this.updateProgress(progress);
                    }
                }
            });

            // Načtení českého jazyka
            await this.worker.loadLanguage('ces');
            await this.worker.initialize('ces');

            // Nastavení parametrů pro lepší rozpoznávání
            await this.worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                preserve_interword_spaces: '1',
            });

            this.isInitialized = true;
            console.log('Tesseract inicializován');
        } catch (error) {
            console.error('Chyba při inicializaci Tesseract:', error);
            throw new Error('Nepodařilo se inicializovat OCR engine');
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

            console.log('Spouštím OCR na obrázku:', imageFile.name);

            // Rozpoznání textu
            const { data } = await this.worker.recognize(imageFile);

            console.log('OCR dokončeno. Confidence:', data.confidence);

            return {
                text: data.text,
                confidence: data.confidence,
                words: data.words,
                lines: data.lines,
                paragraphs: data.paragraphs
            };

        } catch (error) {
            console.error('Chyba při OCR:', error);
            throw new Error('Nepodařilo se rozpoznat text z obrázku');
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
