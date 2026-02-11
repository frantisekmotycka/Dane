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
    if (typeof initExportUI === 'function') initExportUI();
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

    // Click na upload area - POUZE pokud se nekliká na tlačítko
    uploadArea.addEventListener('click', (e) => {
        // Neklikat pokud už se kliklo na tlačítko
        if (e.target.classList.contains('btn-upload') || e.target.closest('.btn-upload')) {
            return;
        }
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
        let imageToProcess = file;
        
        // Pokud je to PDF, převedeme na obrázek
        if (file.type === 'application/pdf') {
            console.log('Převádím PDF na obrázek...');
            imageToProcess = await convertPdfToImage(file);
            console.log('PDF převedeno');
        }

        // Zobrazení náhledu
        await showPreview(imageToProcess);

        // OCR zpracování
        console.log('Spouštím OCR...');
        const ocrResult = await ocrProcessor.recognizeText(imageToProcess);

        console.log('OCR dokončeno:', ocrResult);

        // Parsování výsledků
        console.log('Parsování dat...');
        console.log('Raw OCR text length:', ocrResult.text.length);
        console.log('Raw OCR text preview:', ocrResult.text.substring(0, 500));
        
        let parsedResults = invoiceParser.parse(ocrResult.text);
        // Uložíme raw OCR text do parsedResults pro zobrazení
        parsedResults.rawText = ocrResult.text || '';
        console.log('Parsované výsledky:', parsedResults);

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
 * Konverze PDF na obrázek pomocí Canvas API
 */
async function convertPdfToImage(pdfFile) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const typedArray = new Uint8Array(e.target.result);
                
                // Načtení PDF pomocí PDF.js (pokud je dostupné)
                if (typeof pdfjsLib !== 'undefined') {
                    const pdf = await pdfjsLib.getDocument(typedArray).promise;
                    const page = await pdf.getPage(1);
                    
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;
                    
                    // Převod canvas na blob
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/png');
                } else {
                    // Fallback - pokud PDF.js není dostupné
                    reject(new Error('PDF.js není dostupné. Pro zpracování PDF nahrajte obrázek faktury (JPG, PNG).'));
                }
            } catch (error) {
                reject(new Error('Nepodařilo se zpracovat PDF. Zkuste nahrát obrázek faktury.'));
            }
        };
        
        reader.onerror = () => {
            reject(new Error('Chyba při čtení PDF souboru'));
        };
        
        reader.readAsArrayBuffer(pdfFile);
    });
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

    // Helper to set table cell values and apply confidence coloring + edit handler
    function setTableCell(cellId, confId, data, resultsKey) {
        const cell = document.getElementById(cellId);
        const conf = document.getElementById(confId);
        if (!cell) return;

        const hasValue = data && (typeof data === 'string' || typeof data === 'number' || (typeof data === 'object' && (data.value || data.formatted)));
        const displayValue = hasValue ? (typeof data === 'object' ? (data.formatted || data.value) : String(data)) : '';

        // Update cell text
        cell.textContent = displayValue;

        // Clear classes
        cell.classList.remove('cell-high', 'cell-medium', 'cell-low', 'cell-missing');
        if (conf) conf.className = 'conf-badge';

        // Determine confidence
        let confKey = data && data.confidence ? data.confidence : (hasValue ? 'medium' : 'missing');
        if (confKey === 'calculated') confKey = 'medium';

        if (!hasValue) {
            cell.classList.add('cell-missing');
            if (conf) { conf.textContent = 'Nenalezeno'; conf.classList.add('low'); }
        } else if (confKey === 'high') {
            cell.classList.add('cell-high');
            if (conf) { conf.textContent = 'Vysoká spolehlivost'; conf.classList.add('high'); }
        } else if (confKey === 'medium') {
            cell.classList.add('cell-medium');
            if (conf) { conf.textContent = 'Střední spolehlivost'; conf.classList.add('medium'); }
        } else {
            cell.classList.add('cell-low');
            if (conf) { conf.textContent = 'Nízká spolehlivost'; conf.classList.add('low'); }
        }

        // Ensure editable
        cell.setAttribute('contenteditable', 'true');

        // On blur, save edited value back to currentResults
        cell.onblur = () => {
            const newVal = cell.textContent.trim();
            if (!currentResults) currentResults = {};
            // Save as simple object to preserve formatting
            if (resultsKey) {
                currentResults[resultsKey] = { value: newVal, confidence: 'edited', formatted: newVal };
            }
        };
    }

    // Map fields into table
    const supplierIcData = results.supplierIc || results.supplierIco || (results.supplier && (results.supplier.value || results.supplier)) || results.ico || results.ic || null;
    setTableCell('cell-supplier-ic', 'conf-supplier-ic', supplierIcData, 'supplierIc');

    const recipientIcData = results.recipientIc || results.recipientIco || null;
    setTableCell('cell-recipient-ic', 'conf-recipient-ic', recipientIcData, 'recipientIc');

    // Invoice / document number
    setTableCell('cell-invoice-number', 'conf-invoice-number', results.invoiceNumber || null, 'invoiceNumber');

    const supplierDicData = results.supplierDic || (results.supplier && (results.supplier.dic || results.supplier.DIC)) || results.dic || null;
    setTableCell('cell-supplier-dic', 'conf-supplier-dic', supplierDicData, 'supplierDic');

    const recipientDicData = results.recipientDic || results.buyerDic || (results.recipient && (results.recipient.dic || results.recipient.DIC)) || results.dic || null;
    setTableCell('cell-recipient-dic', 'conf-recipient-dic', recipientDicData, 'recipientDic');

    setTableCell('cell-total-amount', 'conf-total-amount', results.totalAmount, 'totalAmount');
    setTableCell('cell-amount-nodph', 'conf-amount-nodph', results.amountWithoutVat, 'amountWithoutVat');
    setTableCell('cell-dph-rate', 'conf-dph-rate', results.vatRate, 'vatRate');
    setTableCell('cell-dph-amount', 'conf-dph-amount', results.vatAmount, 'vatAmount');
    setTableCell('cell-date', 'conf-date', results.date, 'date');

    // Raw text - zobrazit celý rozpoznaný text (může být prázdný)
    if (rawText) rawText.textContent = results.rawText || '';

    // Zobrazení sekce s výsledky
    resultsSection.style.display = 'block';

    // Scroll na výsledky
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Zobrazení jednotlivého výsledku
 */
function displayResult(elementId, data) {
    // Podpora pro různé ID konvence v HTML (např. someValue vs some)
    const valueElement = document.getElementById(`${elementId}Value`) || document.getElementById(elementId);

    // Fallback map pro nekonzistentní názvy confidence elementů
    const confidenceFallbacks = {
        'totalAmount': 'totalConfidence',
        'amountNoDph': 'amountConfidence'
    };

    const confidenceElement = document.getElementById(`${elementId}Confidence`) || document.getElementById(confidenceFallbacks[elementId]) || null;

    // Debug: logovat stav elementů
    console.log('displayResult:', elementId, { valueElement, confidenceElement });

    if (!valueElement) {
        console.warn(`Missing DOM element for ${elementId} (tried '${elementId}Value' and '${elementId}')`);
        return;
    }

    // Podpora pro primitivní hodnoty (řetězec/číslo) nebo objekt s .value
    const hasValue = data && (typeof data === 'string' || typeof data === 'number' || (typeof data === 'object' && data.value));

    if (hasValue) {
        // Zobrazení hodnoty
        const displayValue = (typeof data === 'object') ? (data.formatted || data.value) : String(data);
        valueElement.textContent = displayValue;
        if (valueElement.parentElement) valueElement.parentElement.classList.add('success');

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
        // Nenalezeno - zobrazit prázdný řetězec
        valueElement.textContent = '';
        if (valueElement.parentElement) valueElement.parentElement.classList.remove('success');

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

🏢 IČ: ${currentResults.ic?.value || currentResults.ic || currentResults.ico?.value || currentResults.ico || ''}
🔖 DIČ dodavatele: ${currentResults.supplierDic?.value || currentResults.supplierDic || currentResults.supplier?.dic || currentResults.supplier?.DIC || ''}
📛 DIČ odběratele: ${currentResults.recipientDic?.value || currentResults.recipientDic || currentResults.recipient?.dic || currentResults.recipient?.DIC || ''}
💰 Celková částka: ${currentResults.totalAmount?.formatted || ''}
💵 Částka bez DPH: ${currentResults.amountWithoutVat?.formatted || ''}
📊 DPH sazba: ${currentResults.vatRate?.formatted || ''}
💳 Částka DPH: ${currentResults.vatAmount?.formatted || ''}
📅 Datum: ${currentResults.date?.value || ''}

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

// --- Export UI logic ---
let exportCurrentItems = [];

function isoFromDateText(dateText) {
    if (!dateText) return null;
    const parts = dateText.split('.').map(p => p.trim());
    if (parts.length < 3) return null;
    const dd = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const yyyy = parts[2];
    return `${yyyy}-${mm}-${dd}`;
}

function computeRange(type, year, period) {
    if (!year) return { from: null, to: null };
    const y = String(year);
    if (type === 'monthly') {
        const mm = String(period).padStart(2, '0');
        const from = `${y}-${mm}-01`;
        const lastDay = new Date(Number(y), Number(mm), 0).getDate();
        const to = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
        return { from, to };
    } else if (type === 'quarterly') {
        const q = Number(period) || 1;
        const startMonth = (q - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const from = `${y}-${String(startMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(Number(y), endMonth, 0).getDate();
        const to = `${y}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return { from, to };
    } else {
        // yearly
        return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
}

async function populateExportYears() {
    const yearSel = document.getElementById('exportYear');
    if (!yearSel) return;
    yearSel.innerHTML = '<option value="">-- vyberte rok --</option>';
    try {
        const res = await fetch('/api/documents');
        if (res.ok) {
            const data = await res.json();
            const docs = Array.isArray(data) ? data : (data.items || []);
            const years = new Set();
            docs.forEach(d => {
                const y = d.date_iso ? String(d.date_iso).slice(0,4) : (d.date_text ? (isoFromDateText(d.date_text) || '').slice(0,4) : null);
                if (y) years.add(y);
            });
            const arr = Array.from(years).sort((a,b) => b - a);
            arr.forEach(y => { const opt = document.createElement('option'); opt.value = y; opt.textContent = y; yearSel.appendChild(opt); });
            return;
        }
        // If API responded but not OK (e.g., 401), fall through to fallback
    } catch (err) {
        console.error('populateExportYears error', err);
    }

    // Fallback: try to list files from testFaktury/ and uploads/ directory listings
    try {
        const paths = ['/testFaktury/', '/uploads/'];
        const years = new Set();
        for (const p of paths) {
            try {
                const r = await fetch(p);
                if (!r.ok) continue;
                const txt = await r.text();
                // find hrefs (simple parsing of directory listing)
                const re = /href\s*=\s*"([^"]+)"/gi;
                let m;
                while ((m = re.exec(txt)) !== null) {
                    const name = m[1];
                    // skip parent links
                    if (name === '../') continue;
                    // try to extract 4-digit year
                    const yearMatch = name.match(/(20\d{2}|19\d{2})/);
                    if (yearMatch) {
                        years.add(yearMatch[0]);
                        continue;
                    }
                    // try patterns like fYYYYMM
                    const fmatch = name.match(/(\d{4})0?([1-9]|1[0-2])/);
                    if (fmatch) years.add(fmatch[1]);
                }
            } catch (e) {
                // ignore per-path errors
            }
        }
        const arr = Array.from(years).sort((a,b) => b - a);
        arr.forEach(y => { const opt = document.createElement('option'); opt.value = y; opt.textContent = y; yearSel.appendChild(opt); });
    } catch (e) {
        console.error('populateExportYears fallback error', e);
    }
}

function fillPeriodOptions(type) {
    const periodRow = document.getElementById('exportPeriodRow');
    const periodSel = document.getElementById('exportPeriod');
    if (!periodSel || !periodRow) return;
    periodSel.innerHTML = '';
    if (type === 'monthly') {
        periodRow.style.display = '';
        const months = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
        months.forEach((m, i) => {
            const opt = document.createElement('option'); opt.value = String(i+1).padStart(2,'0'); opt.textContent = `${i+1} — ${m}`; periodSel.appendChild(opt);
        });
    } else if (type === 'quarterly') {
        periodRow.style.display = '';
        for (let q=1;q<=4;q++) { const opt = document.createElement('option'); opt.value = String(q); opt.textContent = `Q${q}`; periodSel.appendChild(opt); }
    } else {
        periodRow.style.display = 'none';
    }
}

async function fetchExportedDocs(dateFrom, dateTo) {
    const table = document.getElementById('exportTable');
    const tableBody = document.getElementById('exportTableBody');
    const empty = document.getElementById('exportEmpty');
    const summaryRow = document.getElementById('exportSummaryRow');
    const totalEl = document.getElementById('exportTotalSum');

    if (!dateFrom || !dateTo) {
        alert('Vyberte platné období');
        return;
    }

    table.style.display = 'none';
    empty.style.display = 'none';
    summaryRow.style.display = 'none';
    tableBody.innerHTML = '';

    try {
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, per_page: '1000' });
        const res = await fetch(`/api/documents?${params.toString()}`);
        if (!res.ok) throw new Error('Chyba při dotazu na API');
        const data = await res.json();
        const docs = Array.isArray(data) ? data : (data.items || []);
        exportCurrentItems = docs;
        renderExportTable(docs);
    } catch (err) {
        console.error('fetchExportedDocs error', err);
        alert('Chyba při načítání dat. Zkontrolujte server.');
    }
}

function renderExportTable(items) {
    const table = document.getElementById('exportTable');
    const tableBody = document.getElementById('exportTableBody');
    const empty = document.getElementById('exportEmpty');
    const summaryRow = document.getElementById('exportSummaryRow');
    const totalEl = document.getElementById('exportTotalSum');

    tableBody.innerHTML = '';
    if (!items || items.length === 0) {
        table.style.display = 'none'; empty.style.display = ''; summaryRow.style.display = 'none';
        return;
    }

    let total = 0;
    items.forEach(d => {
        const tr = document.createElement('tr');
        const date = d.date_text || (d.date_iso ? d.date_iso : '');
        const invoiceNo = d.invoice_number || d.document_name || '';
        const sIc = d.supplier_ic || '';
        const rIc = d.recipient_ic || '';
        const amount = Number(d.total_amount || d.total || 0);
        total += amount;

        tr.innerHTML = `
            <td>${date}</td>
            <td>${invoiceNo}</td>
            <td>${sIc}</td>
            <td>${rIc}</td>
            <td style="text-align:right;">${formatMoney(amount)}</td>
        `;
        tableBody.appendChild(tr);
    });

    totalEl.textContent = formatMoney(total);
    table.style.display = '';
    empty.style.display = 'none';
    summaryRow.style.display = '';
}

function formatMoney(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function downloadCurrentExport() {
    if (!exportCurrentItems || exportCurrentItems.length === 0) { alert('Nejsou žádná data ke stažení'); return; }
    const blob = new Blob([JSON.stringify(exportCurrentItems, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function initExportUI() {
    const pre = document.getElementById('exportPrehled');
    const yearSel = document.getElementById('exportYear');
    const periodSel = document.getElementById('exportPeriod');
    const applyBtn = document.getElementById('exportApplyBtn');
    const downloadBtn = document.getElementById('exportDownloadBtn');

    if (!pre || !yearSel || !applyBtn || !downloadBtn) return;

    pre.addEventListener('change', () => { fillPeriodOptions(pre.value); });
    yearSel.addEventListener('change', () => {});
    applyBtn.addEventListener('click', () => {
        const type = pre.value; const year = yearSel.value; const period = periodSel ? periodSel.value : null;
        const { from, to } = computeRange(type, year, period);
        if (!from || !to) { alert('Vyberte rok (a případně měsíc/čtvrtletí)'); return; }
        fetchExportedDocs(from, to);
    });
    downloadBtn.addEventListener('click', downloadCurrentExport);

    // Initial fill
    fillPeriodOptions(pre.value);
    populateExportYears();
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
