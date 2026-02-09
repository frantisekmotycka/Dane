/**
 * Hlavní aplikační JavaScript
 * Řídí UI a volá OCR a Parser
 */

// Globální proměnné
let currentResults = null;

// DOM elementy
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const loading = document.getElementById('loading');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const rawText = document.getElementById('rawText');

/**
 * Inicializace aplikace
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Aplikace inicializována');
    setupEventListeners();
});

/**
 * Nastavení event listenerů
 */
function setupEventListeners() {
    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Click na upload area
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
}

/**
 * Zpracování výběru souboru
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

/**
 * Zpracování souboru
 */
async function handleFile(file) {
    console.log('Zpracovávám soubor:', file.name);

    // Validace typu souboru
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        showError('Nepodporovaný formát souboru. Použijte JPG, PNG nebo PDF.');
        return;
    }

    // Validace velikosti (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showError('Soubor je příliš velký. Maximum je 10 MB.');
        return;
    }

    // Reset UI
    hideAllSections();
    showLoading();

    try {
        // Zobrazení náhledu
        await showPreview(file);

        // OCR zpracování
        console.log('Spouštím OCR...');
        const ocrResult = await ocrProcessor.recognizeText(file);

        console.log('OCR dokončeno:', ocrResult);

        // Parsování výsledků
        console.log('Parsování dat...');
        let parsedResults = invoiceParser.parse(ocrResult.text);

        // Výpočet chybějících hodnot
        parsedResults = invoiceParser.calculateMissingValues(parsedResults);

        // Uložení výsledků
        currentResults = parsedResults;

        // Zobrazení výsledků
        displayResults(parsedResults, ocrResult.confidence);

        // Skrytí loading
        hideLoading();

    } catch (error) {
        console.error('Chyba při zpracování:', error);
        hideLoading();
        showError(error.message || 'Nepodařilo se zpracovat dokument. Zkuste to prosím znovu.');
    }
}

/**
 * Zobrazení náhledu obrázku
 */
function showPreview(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewSection.style.display = 'block';
            resolve();
        };

        reader.onerror = () => {
            reject(new Error('Nepodařilo se načíst náhled'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Zobrazení výsledků
 */
function displayResults(results, ocrConfidence) {
    console.log('Zobrazuji výsledky:', results);

    // IČO
    displayResult('ico', results.ico);

    // Celková částka
    displayResult('totalAmount', results.totalAmount);

    // Částka bez DPH
    displayResult('amountNoDph', results.amountWithoutVat);

    // DPH sazba
    displayResult('dphRate', results.vatRate);

    // DPH částka
    displayResult('dphAmount', results.vatAmount);

    // Datum
    displayResult('date', results.date);

    // Raw text
    rawText.textContent = results.rawText;

    // Zobrazení sekce s výsledky
    resultsSection.style.display = 'block';

    // Scroll na výsledky
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Zobrazení jednotlivého výsledku
 */
function displayResult(elementId, data) {
    const valueElement = document.getElementById(`${elementId}Value`);
    const confidenceElement = document.getElementById(`${elementId}Confidence`);

    if (data && data.value) {
        // Zobrazení hodnoty
        const displayValue = data.formatted || data.value;
        valueElement.textContent = displayValue;
        valueElement.parentElement.classList.add('success');

        // Zobrazení confidence
        if (confidenceElement && data.confidence) {
            const confidenceText = {
                'high': '✓ Vysoká spolehlivost',
                'medium': '~ Střední spolehlivost',
                'low': '? Nízká spolehlivost',
                'calculated': '🔢 Vypočítáno'
            };

            confidenceElement.textContent = confidenceText[data.confidence] || '';
            confidenceElement.className = `confidence ${data.confidence}`;
        }
    } else {
        // Nenalezeno
        valueElement.textContent = 'Nenalezeno';
        valueElement.parentElement.classList.remove('success');

        if (confidenceElement) {
            confidenceElement.textContent = '';
        }
    }
}

/**
 * Toggle raw textu
 */
function toggleRawText() {
    if (rawText.style.display === 'none') {
        rawText.style.display = 'block';
    } else {
        rawText.style.display = 'none';
    }
}

/**
 * Kopírování výsledků do schránky
 */
function copyResults() {
    if (!currentResults) return;

    const text = `
📄 VÝSLEDKY OCR ČTENÍ FAKTURY
================================

🏢 IČO: ${currentResults.ico?.value || 'Nenalezeno'}
💰 Celková částka: ${currentResults.totalAmount?.formatted || 'Nenalezeno'}
💵 Částka bez DPH: ${currentResults.amountWithoutVat?.formatted || 'Nenalezeno'}
📊 DPH sazba: ${currentResults.vatRate?.formatted || 'Nenalezeno'}
💳 Částka DPH: ${currentResults.vatAmount?.formatted || 'Nenalezeno'}
📅 Datum: ${currentResults.date?.value || 'Nenalezeno'}

================================
Vygenerováno: ${new Date().toLocaleString('cs-CZ')}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
        // Zobrazení notifikace
        alert('✓ Výsledky zkopírovány do schránky!');
    }).catch(err => {
        console.error('Chyba při kopírování:', err);
        alert('❌ Nepodařilo se zkopírovat do schránky');
    });
}

/**
 * Reset formuláře
 */
function resetForm() {
    fileInput.value = '';
    currentResults = null;
    hideAllSections();
    
    // Scroll nahoru
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Zobrazení loading
 */
function showLoading() {
    loading.style.display = 'block';
}

/**
 * Skrytí loading
 */
function hideLoading() {
    loading.style.display = 'none';
}

/**
 * Zobrazení chyby
 */
function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
}

/**
 * Skrytí všech sekcí
 */
function hideAllSections() {
    loading.style.display = 'none';
    previewSection.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
}

/**
 * Demo mode - pro testování bez nahrávání souboru
 */
function loadDemoInvoice() {
    const demoText = `
FAKTURA č. 2024001

Dodavatel:
ABC s.r.o.
IČO: 12345678
DIČ: CZ12345678

Základ DPH 21%: 10 000,00 Kč
DPH 21%: 2 100,00 Kč
Celkem k úhradě: 12 100,00 Kč

Datum vystavení: 15.01.2024
    `;

    const parsedResults = invoiceParser.parse(demoText);
    currentResults = invoiceParser.calculateMissingValues(parsedResults);
    displayResults(currentResults, 100);
    resultsSection.style.display = 'block';
}

// Export pro použití v konzoli
window.loadDemoInvoice = loadDemoInvoice;
window.resetForm = resetForm;
window.copyResults = copyResults;
window.toggleRawText = toggleRawText;
