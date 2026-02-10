/**
 * Hlavní aplikační JavaScript
 * Řídí UI a volá OCR a Parser
 */

// Globální proměnné
let currentResults = null;
let currentFileName = '';
let currentOcrText = '';
let currentUser = null;
let currentFileBlob = null;

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
const saveResultsBtn = document.getElementById('saveResultsBtn');
const authForm = document.getElementById('authForm');
const authMessage = document.getElementById('authMessage');
const authStatus = document.getElementById('authStatus');
const authUser = document.getElementById('authUser');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const savedSection = document.getElementById('savedSection');
const savedTableBody = document.getElementById('savedTableBody');
const savedEmpty = document.getElementById('savedEmpty');
const filterApplyBtn = document.getElementById('filterApplyBtn');
const filterResetBtn = document.getElementById('filterResetBtn');
const filterSearch = document.getElementById('filterSearch');
const filterSupplierIc = document.getElementById('filterSupplierIc');
const filterRecipientIc = document.getElementById('filterRecipientIc');
const filterInvoiceNumber = document.getElementById('filterInvoiceNumber');
const filterDateFrom = document.getElementById('filterDateFrom');
const filterDateTo = document.getElementById('filterDateTo');
const filterMinTotal = document.getElementById('filterMinTotal');
const filterMaxTotal = document.getElementById('filterMaxTotal');
const savedDetail = document.getElementById('savedDetail');
const savedDetailGrid = document.getElementById('savedDetailGrid');
const savedDetailRaw = document.getElementById('savedDetailRaw');
const closeDetailBtn = document.getElementById('closeDetailBtn');

/**
 * Inicializace aplikace
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Aplikace inicializována');
    setupEventListeners();
    initAuth();
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

    if (authForm) {
        authForm.addEventListener('submit', handleLogin);
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    if (saveResultsBtn) {
        saveResultsBtn.addEventListener('click', saveResultsToDb);
    }
    if (filterApplyBtn) {
        filterApplyBtn.addEventListener('click', () => loadSavedDocuments());
    }
    if (filterResetBtn) {
        filterResetBtn.addEventListener('click', resetFilters);
    }
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', () => {
            if (savedDetail) savedDetail.style.display = 'none';
        });
    }
}

// Pokud je stránka otevřena přes file://, nastavíme explicitně localhost server
const API_BASE = (window.location && window.location.protocol === 'file:') ? 'http://localhost:8000' : '';

function getToken() {
    return localStorage.getItem('ocrToken');
}

function setToken(token) {
    if (token) {
        localStorage.setItem('ocrToken', token);
    } else {
        localStorage.removeItem('ocrToken');
    }
}

function setAuthMessage(message, type = '') {
    if (!authMessage) return;
    authMessage.textContent = message || '';
    authMessage.className = 'auth-message';
    if (type) authMessage.classList.add(type);
}

async function apiFetch(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers
    });

    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        data = await response.json();
    }

    if (!response.ok) {
        const errorMsg = (data && data.error) ? data.error : 'Chyba komunikace se serverem';
        throw new Error(errorMsg);
    }
    return data;
}

async function initAuth() {
    const token = getToken();
    if (!token) {
        updateAuthUI(null);
        return;
    }

    try {
        const data = await apiFetch('/api/me');
        updateAuthUI(data.user);
        await loadSavedDocuments();
    } catch (err) {
        console.warn('Token není platný:', err);
        setToken(null);
        updateAuthUI(null);
    }
}

function updateAuthUI(user) {
    currentUser = user || null;

    if (authForm && authStatus && authUser) {
        if (currentUser) {
            authForm.style.display = 'none';
            authStatus.style.display = 'flex';
            authUser.textContent = currentUser.username || '';
        } else {
            authForm.style.display = 'grid';
            authStatus.style.display = 'none';
            authUser.textContent = '';
        }
    }

    if (savedSection) {
        savedSection.style.display = currentUser ? 'block' : 'none';
    }
    if (saveResultsBtn) {
        saveResultsBtn.disabled = !currentUser;
        saveResultsBtn.title = currentUser ? '' : 'Pro uložení se nejprve přihlaste.';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = (document.getElementById('authUsername') || {}).value || '';
    const password = (document.getElementById('authPassword') || {}).value || '';

    setAuthMessage('Přihlašuji...', '');

    try {
        const data = await apiFetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        setToken(data.token);
        setAuthMessage('Úspěšně přihlášeno.', 'success');
        updateAuthUI(data.user);
        await loadSavedDocuments();
    } catch (err) {
        setAuthMessage(err.message || 'Nepodařilo se přihlásit.', 'error');
    }
}

async function handleRegister() {
    const username = (document.getElementById('authUsername') || {}).value || '';
    const password = (document.getElementById('authPassword') || {}).value || '';

    // Client-side validation to avoid server 400 for short values
    if (username.trim().length < 3) {
        setAuthMessage('Uživatelské jméno musí mít alespoň 3 znaky.', 'error');
        return;
    }
    if (password.length < 4) {
        setAuthMessage('Heslo musí mít alespoň 4 znaky.', 'error');
        return;
    }

    setAuthMessage('Vytvářím účet...', '');

    try {
        const data = await apiFetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        // server returns { ok: true } on success
        if (data && data.ok) {
            setAuthMessage('Účet vytvořen. Nyní se můžete přihlásit.', 'success');
        } else {
            setAuthMessage('Účet vytvořen (server odpověď neobsahovala potvrzení).', 'success');
        }
    } catch (err) {
        // Show server-provided message when available, otherwise generic
        setAuthMessage(err.message || 'Nepodařilo se vytvořit účet.', 'error');
    }
}

async function handleLogout() {
    try {
        await apiFetch('/api/logout', { method: 'POST' });
    } catch (err) {
        console.warn('Odhlášení selhalo:', err);
    }
    setToken(null);
    updateAuthUI(null);
}

function resetFilters() {
    if (filterSearch) filterSearch.value = '';
    if (filterSupplierIc) filterSupplierIc.value = '';
    if (filterRecipientIc) filterRecipientIc.value = '';
    if (filterInvoiceNumber) filterInvoiceNumber.value = '';
    if (filterDateFrom) filterDateFrom.value = '';
    if (filterDateTo) filterDateTo.value = '';
    if (filterMinTotal) filterMinTotal.value = '';
    if (filterMaxTotal) filterMaxTotal.value = '';
    loadSavedDocuments();
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
    currentFileName = file.name;

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

        // store original file blob for saving
        currentFileBlob = file;

        // OCR zpracování
        console.log('Spouštím OCR...');
        const ocrResult = await ocrProcessor.recognizeText(imageToProcess);
        currentOcrText = ocrResult.text || '';

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

function getFieldString(field) {
    if (field == null) return '';
    if (typeof field === 'object') {
        if (field.formatted != null) return String(field.formatted);
        if (field.value != null) return String(field.value);
    }
    return String(field);
}

function getFieldNumber(field) {
    if (field == null) return null;
    if (typeof field === 'number') return field;
    if (typeof field === 'object') {
        if (typeof field.value === 'number') return field.value;
        if (field.value != null) return parseNumericAmount(field.value);
        if (field.formatted != null) return parseNumericAmount(field.formatted);
    }
    return parseNumericAmount(field);
}

function parseNumericAmount(value) {
    if (value == null) return null;
    const s = String(value).replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
    if (!s) return null;
    const normalized = s.replace(',', '.');
    const num = parseFloat(normalized);
    return Number.isNaN(num) ? null : num;
}

async function saveResultsToDb() {
    if (!currentUser) {
        alert('Nejprve se prosím přihlaste.');
        return;
    }
    if (!currentResults) {
        alert('Nejsou k dispozici žádné výsledky k uložení.');
        return;
    }

    // If we have original file, convert to base64
    let documentBase64 = null;
    let documentMime = null;
    if (currentFileBlob) {
        documentMime = currentFileBlob.type || '';
        documentBase64 = await new Promise((resolve) => {
            const r = new FileReader();
            r.onload = () => {
                const dataUrl = r.result || '';
                const parts = String(dataUrl).split(',');
                resolve(parts.length > 1 ? parts[1] : parts[0]);
            };
            r.onerror = () => resolve(null);
            r.readAsDataURL(currentFileBlob);
        });
    }

    const payload = {
        documentName: currentFileName || 'OCR dokument',
        rawText: currentResults.rawText || currentOcrText || '',
        fields: {
            supplier_ic: getFieldString(currentResults.supplierIc || currentResults.supplierIco || currentResults.ico || ''),
            recipient_ic: getFieldString(currentResults.recipientIc || currentResults.recipientIco || ''),
            invoice_number: getFieldString(currentResults.invoiceNumber || ''),
            supplier_dic: getFieldString(currentResults.supplierDic || currentResults.dic || ''),
            recipient_dic: getFieldString(currentResults.recipientDic || ''),
            total_amount: getFieldNumber(currentResults.totalAmount),
            amount_without_vat: getFieldNumber(currentResults.amountWithoutVat),
            vat_rate: getFieldNumber(currentResults.vatRate),
            vat_amount: getFieldNumber(currentResults.vatAmount),
            date_text: getFieldString(currentResults.date || '')
        },
        data: currentResults,
        documentBase64,
        documentMime,
        documentFilename: currentFileBlob ? (currentFileBlob.name || currentFileName) : null
    };

    try {
        await apiFetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        alert('✓ Výsledky byly uloženy do databáze.');
        await loadSavedDocuments();
    } catch (err) {
        alert(err.message || 'Nepodařilo se uložit výsledky.');
    }
}

function formatCurrency(value) {
    if (value == null || value === '') return '';
    return new Intl.NumberFormat('cs-CZ', {
        style: 'currency',
        currency: 'CZK',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function collectFilters() {
    return {
        search: filterSearch ? filterSearch.value.trim() : '',
        supplier_ic: filterSupplierIc ? filterSupplierIc.value.trim() : '',
        recipient_ic: filterRecipientIc ? filterRecipientIc.value.trim() : '',
        invoice_number: filterInvoiceNumber ? filterInvoiceNumber.value.trim() : '',
        date_from: filterDateFrom ? filterDateFrom.value : '',
        date_to: filterDateTo ? filterDateTo.value : '',
        min_total: filterMinTotal ? filterMinTotal.value : '',
        max_total: filterMaxTotal ? filterMaxTotal.value : ''
    };
}

async function loadSavedDocuments() {
    if (!currentUser) return;

    const filters = collectFilters();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });

    try {
        const data = await apiFetch(`/api/documents?${params.toString()}`);
        renderSavedDocuments(data.items || []);
    } catch (err) {
        console.error('Nepodařilo se načíst uložené dokumenty:', err);
    }
}

function renderSavedDocuments(items) {
    if (!savedTableBody || !savedEmpty) return;
    savedTableBody.innerHTML = '';
    if (savedDetail) savedDetail.style.display = 'none';

    if (!items.length) {
        savedEmpty.style.display = 'block';
        return;
    }

    savedEmpty.style.display = 'none';
    items.forEach((item) => {
        const tr = document.createElement('tr');
        const totalText = item.total_amount != null ? formatCurrency(item.total_amount) : '';
        tr.innerHTML = `
            <td>${item.date_text || ''}</td>
            <td>${item.invoice_number || ''}</td>
            <td>${item.supplier_ic || ''}</td>
            <td>${item.recipient_ic || ''}</td>
            <td>${totalText}</td>
            <td>
                <button class="btn-secondary btn-small" data-action="view" data-id="${item.id}">Zobrazit</button>
                <button class="btn-primary btn-small" data-action="edit" data-id="${item.id}">Upravit</button>
                <button class="btn-secondary btn-small" data-action="delete" data-id="${item.id}">Smazat</button>
            </td>
        `;
        tr.querySelectorAll('button').forEach(btn => {
            const id = btn.getAttribute('data-id');
            const action = btn.getAttribute('data-action');
            if (action === 'view') btn.addEventListener('click', () => loadDocumentDetail(id, false));
            if (action === 'edit') btn.addEventListener('click', () => loadDocumentDetail(id, true));
            if (action === 'delete') btn.addEventListener('click', () => deleteDocument(id));
        });
        savedTableBody.appendChild(tr);
    });
}

async function loadDocumentDetail(id, editMode = false) {
    if (!id) return;
    try {
        const data = await apiFetch(`/api/documents/${id}`);
        const doc = data.document;
        if (!doc) return;
        if (savedDetailGrid) {
            savedDetailGrid.innerHTML = '';

            // If editMode, render inputs, otherwise show read-only blocks
            const makeRow = (label, key, value, opts = {}) => {
                const div = document.createElement('div');
                div.className = 'saved-detail-item';
                if (editMode) {
                    const input = document.createElement(opts.type === 'textarea' ? 'textarea' : 'input');
                    input.value = value == null ? '' : String(value);
                    input.id = `edit_${key}`;
                    if (opts.type === 'number') input.type = 'number';
                    input.style.width = '100%';
                    div.innerHTML = `<strong>${label}</strong>`;
                    div.appendChild(input);
                } else {
                    div.innerHTML = `<strong>${label}</strong><div>${value == null ? '' : value}</div>`;
                }
                return div;
            };

            savedDetailGrid.appendChild(makeRow('Název dokumentu', 'document_name', doc.document_name || ''));
            savedDetailGrid.appendChild(makeRow('Datum', 'date_text', doc.date_text || ''));
            savedDetailGrid.appendChild(makeRow('Číslo faktury', 'invoice_number', doc.invoice_number || ''));
            savedDetailGrid.appendChild(makeRow('IČ dodavatele', 'supplier_ic', doc.supplier_ic || ''));
            savedDetailGrid.appendChild(makeRow('IČ odběratele', 'recipient_ic', doc.recipient_ic || ''));
            savedDetailGrid.appendChild(makeRow('DIČ dodavatele', 'supplier_dic', doc.supplier_dic || ''));
            savedDetailGrid.appendChild(makeRow('DIČ odběratele', 'recipient_dic', doc.recipient_dic || ''));
            savedDetailGrid.appendChild(makeRow('Celkem', 'total_amount', doc.total_amount != null ? formatCurrency(doc.total_amount) : '', { type: 'number' }));
            savedDetailGrid.appendChild(makeRow('Bez DPH', 'amount_without_vat', doc.amount_without_vat != null ? formatCurrency(doc.amount_without_vat) : '', { type: 'number' }));
            savedDetailGrid.appendChild(makeRow('DPH sazba', 'vat_rate', doc.vat_rate != null ? `${doc.vat_rate}` : '', { type: 'number' }));
            savedDetailGrid.appendChild(makeRow('DPH částka', 'vat_amount', doc.vat_amount != null ? formatCurrency(doc.vat_amount) : '', { type: 'number' }));

            // file / preview
            if (doc.document_base64) {
                const mime = doc.document_mime || '';
                const imgDiv = document.createElement('div');
                imgDiv.className = 'saved-detail-item';
                imgDiv.innerHTML = `<strong>Originál</strong>`;
                if (mime.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.style.maxWidth = '100%';
                    img.src = `data:${mime};base64,${doc.document_base64}`;
                    imgDiv.appendChild(img);
                } else if (mime === 'application/pdf') {
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '600px';
                    iframe.src = `/api/documents/${id}/file`;
                    imgDiv.appendChild(iframe);
                } else {
                    const a = document.createElement('a');
                    a.href = `/api/documents/${id}/file`;
                    a.textContent = doc.document_filename || 'Stáhnout soubor';
                    imgDiv.appendChild(a);
                }
                savedDetailGrid.appendChild(imgDiv);
            }

            // raw text
            if (savedDetailRaw) savedDetailRaw.textContent = doc.raw_text || '';

            // actions
            const actionsDiv = document.createElement('div');
            actionsDiv.style.marginTop = '12px';
            if (editMode) {
                const saveBtn = document.createElement('button');
                saveBtn.className = 'btn-primary';
                saveBtn.textContent = 'Uložit změny';
                saveBtn.addEventListener('click', () => updateDocument(id));
                actionsDiv.appendChild(saveBtn);

                const delBtn = document.createElement('button');
                delBtn.className = 'btn-secondary';
                delBtn.textContent = 'Smazat záznam';
                delBtn.style.marginLeft = '8px';
                delBtn.addEventListener('click', () => { if (confirm('Opravdu smazat tento záznam?')) deleteDocument(id); });
                actionsDiv.appendChild(delBtn);
            } else {
                const editBtn = document.createElement('button');
                editBtn.className = 'btn-primary';
                editBtn.textContent = 'Upravit';
                editBtn.addEventListener('click', () => loadDocumentDetail(id, true));
                actionsDiv.appendChild(editBtn);

                const delBtn = document.createElement('button');
                delBtn.className = 'btn-secondary';
                delBtn.textContent = 'Smazat';
                delBtn.style.marginLeft = '8px';
                delBtn.addEventListener('click', () => { if (confirm('Opravdu smazat tento záznam?')) deleteDocument(id); });
                actionsDiv.appendChild(delBtn);
            }

            savedDetailGrid.appendChild(actionsDiv);
        }
        if (savedDetail) savedDetail.style.display = 'block';
    } catch (err) {
        console.error('Nepodařilo se načíst detail:', err);
    }
}

async function deleteDocument(id) {
    try {
        await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
        alert('Záznam odstraněn');
        await loadSavedDocuments();
    } catch (err) {
        alert(err.message || 'Nepodařilo se smazat záznam');
    }
}

async function updateDocument(id) {
    try {
        const payloadFields = {};
        ['document_name','date_text','invoice_number','supplier_ic','recipient_ic','supplier_dic','recipient_dic','total_amount','amount_without_vat','vat_rate','vat_amount','raw_text'].forEach(k => {
            const el = document.getElementById(`edit_${k}`);
            if (el) payloadFields[k] = el.value;
        });

        // Try POST first (server supports POST for updates), but some servers
        // may expect PUT. If server returns Not Found, retry with PUT.
        try {
            await apiFetch(`/api/documents/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: payloadFields })
            });
        } catch (err) {
            const msg = (err && err.message) ? String(err.message).toLowerCase() : '';
            if (msg.includes('not found')) {
                // Retry with PUT as a fallback
                await apiFetch(`/api/documents/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fields: payloadFields })
                });
            } else {
                throw err;
            }
        }
        alert('Uloženo');
        await loadSavedDocuments();
        await loadDocumentDetail(id, false);
    } catch (err) {
        alert(err.message || 'Nepodařilo se uložit změny');
    }
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

/**
 * Reset formuláře
 */
function resetForm() {
    fileInput.value = '';
    currentResults = null;
    currentFileName = '';
    currentOcrText = '';
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
    currentFileName = 'demo.txt';
    currentOcrText = demoText;
    displayResults(currentResults, 100);
    resultsSection.style.display = 'block';
}

// Export pro použití v konzoli
window.loadDemoInvoice = loadDemoInvoice;
window.resetForm = resetForm;
window.copyResults = copyResults;
window.toggleRawText = toggleRawText;
