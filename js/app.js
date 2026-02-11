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
const headerLoginBtn = document.getElementById('headerLoginBtn');
const headerRegisterBtn = document.getElementById('headerRegisterBtn');
const headerAuthControls = document.getElementById('headerAuthControls');
const headerUserBtn = document.getElementById('headerUserBtn');
const headerUsernameShort = document.getElementById('headerUsernameShort');
const headerUserMenu = document.getElementById('headerUserMenu');
const headerDropdown = document.getElementById('headerDropdown');
const headerDropdownLogout = document.getElementById('headerDropdownLogout');
const profileLink = document.getElementById('profileLink');
const savedSection = document.getElementById('savedSection');
const savedTableBody = document.getElementById('savedTableBody');
const savedEmpty = document.getElementById('savedEmpty');
const navLoad = document.getElementById('navLoad');
const navSaved = document.getElementById('navSaved');
const navExport = document.getElementById('navExport');
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
    // Initialize export UI controls (if present)
    try { initExportUI(); } catch (e) { console.warn('initExportUI not available yet', e); }
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
    if (headerLoginBtn) {
        headerLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const as = document.getElementById('authSection');
            if (as) {
                as.classList.add('visible');
                const el = document.getElementById('authUsername');
                if (el) el.focus();
                // Show only login action in the auth form
                if (loginBtn) loginBtn.style.display = 'inline-block';
                if (registerBtn) registerBtn.style.display = 'none';
                if (authMessage) authMessage.textContent = '';
                as.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    if (headerRegisterBtn) {
        headerRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const as = document.getElementById('authSection');
            if (as) {
                as.classList.add('visible');
                const el = document.getElementById('authUsername');
                if (el) el.focus();
                // Show only register action in the auth form
                if (loginBtn) loginBtn.style.display = 'none';
                if (registerBtn) registerBtn.style.display = 'inline-block';
                if (authMessage) authMessage.textContent = '';
                as.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    if (headerUserBtn) {
        headerUserBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!headerDropdown) return;
            const open = headerDropdown.style.display === 'block';
            headerDropdown.style.display = open ? 'none' : 'block';
            headerUserBtn.setAttribute('aria-expanded', String(!open));
        });
    }
    if (navLoad) {
        navLoad.addEventListener('click', (e) => {
            e.preventDefault();
            showOnlyUpload();
        });
    }
    if (navSaved) {
        navSaved.addEventListener('click', (e) => {
            e.preventDefault();
            showOnlySaved();
        });
    }
    if (navExport) {
        navExport.addEventListener('click', (e) => { e.preventDefault(); showOnlyExport(); });
    }
    if (headerDropdownLogout) {
        headerDropdownLogout.addEventListener('click', (e) => { e.preventDefault(); if (headerDropdown) headerDropdown.style.display = 'none'; handleLogout(); });
    }
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!headerDropdown || !headerUserBtn) return;
        if (headerDropdown.style.display !== 'block') return;
        if (headerUserBtn.contains(e.target) || headerDropdown.contains(e.target)) return;
        headerDropdown.style.display = 'none';
        headerUserBtn.setAttribute('aria-expanded', 'false');
    });
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
            const as = document.getElementById('authSection'); if (as) as.classList.remove('visible');
            // header: show user menu
            if (headerUserMenu) headerUserMenu.style.display = 'inline-block';
            if (headerUsernameShort) headerUsernameShort.textContent = currentUser.username || '';
            if (headerAuthControls) headerAuthControls.style.display = 'none';
            if (headerDropdown) headerDropdown.style.display = 'none';
        } else {
            authForm.style.display = 'grid';
            authStatus.style.display = 'none';
            authUser.textContent = '';
            // header: show login/register
            if (headerUserMenu) headerUserMenu.style.display = 'none';
            if (headerUsernameShort) headerUsernameShort.textContent = '';
            if (headerAuthControls) headerAuthControls.style.display = 'flex';
            if (headerDropdown) headerDropdown.style.display = 'none';
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

function openOriginalInWindow(url) {
    // If it's a data: URI, convert to a Blob and use an object URL (more reliable than data: in some browsers)
    const isData = typeof url === 'string' && url.startsWith('data:');
    if (isData) {
        try {
            const parts = url.split(',');
            const meta = parts[0];
            const isBase64 = meta.indexOf(';base64') !== -1;
            const mime = meta.split(':')[1].split(';')[0] || 'application/octet-stream';
            const dataPart = parts.slice(1).join(',');
            let bytes;
            if (isBase64) {
                const bin = atob(dataPart);
                const len = bin.length;
                const arr = new Uint8Array(len);
                for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
                bytes = arr;
            } else {
                const str = decodeURIComponent(dataPart);
                const len = str.length;
                const arr = new Uint8Array(len);
                for (let i = 0; i < len; i++) arr[i] = str.charCodeAt(i);
                bytes = arr;
            }
            const blob = new Blob([bytes], { type: mime });
            const objUrl = URL.createObjectURL(blob);
            // Try opening in a new tab/window without features (more compatible)
            const newWin = window.open(objUrl, '_blank');
            if (!newWin) {
                // popup blocked, use anchor click fallback
                const a = document.createElement('a');
                a.href = objUrl;
                a.target = '_blank';
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                try { newWin.focus(); } catch (e) { /* ignore */ }
            }
            // Revoke object URL after a while
            setTimeout(() => URL.revokeObjectURL(objUrl), 60 * 1000);
            return;
        } catch (e) {
            console.warn('Failed to open data URI via object URL, falling back', e);
        }
    }

    // For normal URLs, open in a new tab. Avoid complex window features to reduce popup issues.
    try {
        const newWin = window.open(url, '_blank');
        if (!newWin) {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            try { newWin.focus(); } catch (e) { /* ignore */ }
        }
    } catch (e) {
        try { window.open(url, '_blank'); } catch (err) { console.error('Unable to open window', err); }
    }
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

async function exportData() {
    if (!currentUser) {
        alert('Pro export dat se prosím přihlaste.');
        return;
    }
    try {
        const list = await apiFetch('/api/documents');
        const items = list.items || [];
        const docs = [];
        for (const it of items) {
            try {
                const d = await apiFetch(`/api/documents/${it.id}`);
                if (d && d.document) docs.push(d.document);
            } catch (e) {
                console.warn('Nepodařilo se stáhnout detail dokumentu', it.id, e);
            }
        }
        const blob = new Blob([JSON.stringify(docs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
        a.download = `export_faktury_${now}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
        alert(err.message || 'Chyba při exportu dat');
    }
}

function hideAllMainSections() {
    const upload = document.querySelector('.upload-section'); if (upload) upload.style.display = 'none';
    const preview = document.getElementById('previewSection'); if (preview) preview.style.display = 'none';
    const results = document.getElementById('resultsSection'); if (results) results.style.display = 'none';
    const saved = document.getElementById('savedSection'); if (saved) saved.style.display = 'none';
    const exportS = document.getElementById('exportSection'); if (exportS) exportS.style.display = 'none';
    if (savedDetail) savedDetail.style.display = 'none';
}

function showOnlyUpload() {
    hideAllMainSections();
    const upload = document.querySelector('.upload-section'); if (upload) upload.style.display = 'block';
    // hide preview/results until file processed
    const preview = document.getElementById('previewSection'); if (preview) preview.style.display = 'none';
    const results = document.getElementById('resultsSection'); if (results) results.style.display = 'none';
}

function showOnlySaved() {
    hideAllMainSections();
    if (!currentUser) { alert('Pro zobrazení uložených faktur se prosím přihlaste.'); return; }
    const saved = document.getElementById('savedSection'); if (saved) { saved.style.display = 'block'; saved.scrollIntoView({ behavior: 'smooth' }); }
    loadSavedDocuments();
}

function showOnlyExport() {
    hideAllMainSections();
    const exportS = document.getElementById('exportSection');
    if (exportS) {
        // each time export section is opened, refresh available years
        const yearSel = exportS.querySelector('#exportYear');
        const periodSel = exportS.querySelector('#exportPeriod');
        if (yearSel) {
            const pre = exportS.querySelector('#exportPrehled');
            populateExportYears(yearSel).then(() => {
                // after years are loaded, refresh period options for selected year
                const y = yearSel.value || (new Date()).getFullYear();
                const type = pre ? pre.value : 'all';
                if (periodSel) fillPeriodOptions(periodSel, Number(y), type === 'monthly' ? 'monthly' : (type === 'quarterly' ? 'quarterly' : 'all'));
            }).catch(err => console.warn('populateExportYears failed', err));
        }
        exportS.style.display = 'block';
        exportS.scrollIntoView({ behavior: 'smooth' });
    }
}

/** EXPORT HELPERS **/
function isoFromDateText(text) {
    if (!text) return null;
    const s = String(text).trim();
    // dd.mm.yyyy
    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // yyyy-mm-dd
    const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) return `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`;
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0,10);
    return null;
}

function computeRange(value) {
    // value formats: 'year:2024', 'month:2024:1', 'quarter:2024:1' (quarter 1..4)
    if (!value) return null;
    const parts = String(value).split(':');
    const type = parts[0];
    const year = Number(parts[1]) || (new Date()).getFullYear();
    if (type === 'year') {
        return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    if (type === 'month') {
        const month = Number(parts[2]) || 1;
        const mm = String(month).padStart(2,'0');
        const from = `${year}-${mm}-01`;
        const last = new Date(year, month, 0).getDate();
        const to = `${year}-${mm}-${String(last).padStart(2,'0')}`;
        return { from, to };
    }
    if (type === 'quarter') {
        const q = Number(parts[2]) || 1;
        const startMonth = (q - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const from = `${year}-${String(startMonth).padStart(2,'0')}-01`;
        const last = new Date(year, endMonth, 0).getDate();
        const to = `${year}-${String(endMonth).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
        return { from, to };
    }
    return null;
}

function fillPeriodOptions(selectEl, year, type = 'all') {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    // Only include the "whole year" option when type is 'all'
    if (type === 'all') {
        const optYear = document.createElement('option'); optYear.value = `year:${year}`; optYear.textContent = `Celý rok ${year}`; selectEl.appendChild(optYear);
    }
    if (type === 'all' || type === 'quarterly') {
        // Quarters: values 1..4, label '1'..'4'
        for (let q = 1; q <= 4; q++) {
            const o = document.createElement('option'); o.value = String(q); o.textContent = String(q); selectEl.appendChild(o);
        }
    }
    if (type === 'all' || type === 'monthly') {
        // Months: values 1..12
        for (let m = 1; m <= 12; m++) {
            const o = document.createElement('option'); o.value = String(m); o.textContent = String(m); selectEl.appendChild(o);
        }
    }
    // If there is a button-group associated with this select, re-render it
    try {
        const btnContainer = document.getElementById(selectEl.id + 'Buttons');
        if (btnContainer) renderButtonGroupForSelect(selectEl, btnContainer);
    } catch (e) { /* ignore */ }
}

// Render a button-group that mirrors a select's options and keeps it in sync
function renderButtonGroupForSelect(selectEl, containerEl) {
    if (!selectEl || !containerEl) return;
    containerEl.innerHTML = '';
    const options = Array.from(selectEl.options || []);
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-option';
        btn.textContent = opt.textContent || opt.value;
        btn.dataset.value = opt.value;
        if (opt.disabled) btn.disabled = true;
        if (selectEl.value === opt.value) btn.classList.add('selected');
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // update select value and trigger change
            selectEl.value = opt.value;
            // update selected class for buttons
            Array.from(containerEl.querySelectorAll('.btn-option')).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const ev = new Event('change', { bubbles: true });
            selectEl.dispatchEvent(ev);
        });
        containerEl.appendChild(btn);
    });
    // listen for programmatic changes on the select (ensure single handler)
    try {
        if (selectEl._btnGroupHandler) selectEl.removeEventListener('change', selectEl._btnGroupHandler);
    } catch (e) {}
    const _handler = () => {
        const val = selectEl.value;
        Array.from(containerEl.querySelectorAll('.btn-option')).forEach(b => b.classList.toggle('selected', b.dataset.value === val));
    };
    selectEl._btnGroupHandler = _handler;
    selectEl.addEventListener('change', _handler);
}

async function populateExportYears(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    const currentYear = new Date().getFullYear();
    // First try to get documents from API (uses apiFetch to include auth token if present)
    try {
        const data = await apiFetch('/api/documents?per_page=1000');
        const items = Array.isArray(data) ? data : (data.items || []);
        const years = new Set();
        items.forEach(d => {
            if (!d) return;
            if (d.date_iso) {
                const y = String(d.date_iso).slice(0,4);
                if (y) years.add(y);
                return;
            }
            if (d.date_text) {
                const iso = isoFromDateText(d.date_text);
                if (iso) years.add(iso.slice(0,4));
            }
        });
        if (years.size) {
            Array.from(years).sort((a,b) => b - a).forEach(y => {
                const o = document.createElement('option'); o.value = String(y); o.textContent = String(y); selectEl.appendChild(o);
            });
            // render custom buttons if present
            try { const btn = document.getElementById(selectEl.id + 'Buttons'); if (btn) renderButtonGroupForSelect(selectEl, btn); } catch(e){}
            return;
        }
    } catch (e) {
        // API may be unavailable or unauthorized; fallback below
        console.warn('populateExportYears: api documents fetch failed, falling back', e);
    }

    // Fallback: try to read directory indices for /testFaktury/ and /uploads/
    try {
        const tried = ['/testFaktury/', '/uploads/'];
        const years = new Set();
        for (const p of tried) {
            try {
                const resp = await fetch(p);
                if (!resp.ok) continue;
                const txt = await resp.text();
                const matches = txt.match(/(20\d{2})/g) || [];
                matches.forEach(y => years.add(y));
                // also try filenames like fYYYYMM
                const fmatch = txt.match(/f(\d{6})/g) || [];
                fmatch.forEach(f => {
                    const m = f.match(/f(\d{4})(\d{2})/);
                    if (m) years.add(m[1]);
                });
            } catch (e) {
                // ignore
            }
        }
        if (years.size) {
            Array.from(years).sort((a,b) => b - a).forEach(y => {
                const o = document.createElement('option'); o.value = String(y); o.textContent = String(y); selectEl.appendChild(o);
            });
            try { const btn = document.getElementById(selectEl.id + 'Buttons'); if (btn) renderButtonGroupForSelect(selectEl, btn); } catch(e){}
            return;
        }
    } catch (e) {
        console.warn('populateExportYears fallback error', e);
    }

    // Final fallback: recent 3 years
    for (let i = 0; i < 3; i++) {
        const y = String(currentYear - i);
        const o = document.createElement('option'); o.value = y; o.textContent = y; selectEl.appendChild(o);
    }
    try { const btn = document.getElementById(selectEl.id + 'Buttons'); if (btn) renderButtonGroupForSelect(selectEl, btn); } catch(e){}
}

async function fetchExportedDocs(range) {
    // range: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
    if (!range) return [];
    try {
        const params = new URLSearchParams({ date_from: range.from, date_to: range.to });
        const data = await apiFetch(`/api/documents?${params.toString()}`);
        return data.items || [];
    } catch (e) {
        console.warn('Primary export fetch failed, fallback not implemented fully', e);
        return [];
    }
}

function renderExportTable(container, items) {
    if (!container) return;
    container.innerHTML = '';
    const table = document.getElementById('exportTable');
    const emptyEl = document.getElementById('exportEmpty');
    const summaryRow = document.getElementById('exportSummaryRow');
    const totalEl = document.getElementById('exportTotalSum');

    if (!items || !items.length) {
        // hide table, show empty message
        if (table) table.style.display = 'none';
        if (summaryRow) summaryRow.style.display = 'none';
        if (emptyEl) emptyEl.style.display = '';
        return;
    }
    // show table and hide empty placeholder
    if (table) table.style.display = '';
    if (emptyEl) emptyEl.style.display = 'none';
    // helper: try several candidate property names and return numeric value or null
    function getNumericField(obj, candidates) {
        if (!obj) return null;
        // helper to parse numbers from various formats using existing parser
        function parseAny(v) {
            if (v == null) return null;
            if (typeof v === 'number') return v;
            if (typeof v === 'string') {
                const p = parseNumericAmount(v);
                return p != null ? p : null;
            }
            if (typeof v === 'object') {
                if (v.value != null) return parseAny(v.value);
                if (v.formatted != null) return parseAny(v.formatted);
            }
            return null;
        }

        // 1) top-level candidates
        for (const k of candidates) {
            if (obj[k] != null) {
                const n = parseAny(obj[k]);
                if (n != null) return n;
            }
        }

        // 2) recursive search for candidate keys anywhere in the object (depth-limited)
        const visited = new WeakSet();
        function deepSearch(o, depth) {
            if (!o || typeof o !== 'object' || visited.has(o) || depth <= 0) return null;
            visited.add(o);
            for (const k of Object.keys(o)) {
                try {
                    if (candidates.includes(k) && o[k] != null) {
                        const n = parseAny(o[k]);
                        if (n != null) return n;
                    }
                } catch (e) { /* ignore */ }
            }
            // descend into child objects/arrays
            for (const k of Object.keys(o)) {
                try {
                    const child = o[k];
                    if (child && typeof child === 'object') {
                        const found = deepSearch(child, depth - 1);
                        if (found != null) return found;
                    }
                } catch (e) { /* ignore */ }
            }
            return null;
        }

        return deepSearch(obj, 4);
    }

    // accumulate sums
    let sumTotal = 0, sumNet = 0, sumVat = 0;

    items.forEach(it => {
        const tr = document.createElement('tr');
        const date = it.date_text || it.date || it.date_iso || '';
        const invoice = it.invoice_number || it.number || it.invoice || '';
        const supplier = it.supplier_ic || it.supplier || it.supplierIco || '';
        const recipient = it.recipient_ic || it.recipient || it.buyer_ic || it.buyer || '';
        // amounts: try multiple field names
        const rawTotal = getNumericField(it, ['total_amount','totalAmount','total','celkem','sum','amount_total']);
        const rawNoVat = getNumericField(it, ['amount_without_vat','amountWithoutVat','price_without_vat','net_amount','no_vat','bez_dph','bezDPH','netto','price_net']);
        const rawVat = getNumericField(it, ['vat_amount','vatAmount','vat','dph_amount','dphAmount','dph','tax_amount','vat_total']);
        // derive missing values
        let totalVal = (!Number.isNaN(rawTotal) && rawTotal != null) ? rawTotal : null;
        let noVatVal = (!Number.isNaN(rawNoVat) && rawNoVat != null) ? rawNoVat : null;
        let vatVal = (!Number.isNaN(rawVat) && rawVat != null) ? rawVat : null;
        if (totalVal == null && noVatVal != null && vatVal != null) totalVal = noVatVal + vatVal;
        if (vatVal == null && totalVal != null && noVatVal != null) vatVal = totalVal - noVatVal;
        if (noVatVal == null && totalVal != null && vatVal != null) noVatVal = totalVal - vatVal;

        const total = totalVal != null ? formatMoney(totalVal) : '';
        const noVat = noVatVal != null ? formatMoney(noVatVal) : '';
        const vat = vatVal != null ? formatMoney(vatVal) : '';
        const hasFile = it.document ? true : false;
        tr.innerHTML = `
            <td>${date}</td>
            <td>${invoice}</td>
            <td>${supplier}</td>
            <td>${recipient}</td>
            <td>${noVat}</td>
            <td>${vat}</td>
            <td>${total}</td>
        `;
        if (hasFile) {
            const btn = tr.querySelector('.btn-export-download');
            if (btn) btn.addEventListener('click', () => {
                // open file
                if (it.document && it.document.document_base64 && it.document.document_mime) {
                    const url = `data:${it.document.document_mime};base64,${it.document.document_base64}`;
                    openOriginalInWindow(url);
                } else {
                    const token = getToken();
                    const url = token ? `/api/documents/${it.id}/file?token=${encodeURIComponent(token)}` : `/api/documents/${it.id}/file`;
                    openOriginalInWindow(url);
                }
            });
        }
        container.appendChild(tr);

        // accumulate sums
        if (totalVal != null && !Number.isNaN(totalVal)) sumTotal += totalVal;
        if (noVatVal != null && !Number.isNaN(noVatVal)) sumNet += noVatVal;
        if (vatVal != null && !Number.isNaN(vatVal)) sumVat += vatVal;
    });
    // compute summary totals and show in footer
    try {
        if (totalEl) totalEl.textContent = formatMoney(sumTotal);
        const netEl = document.getElementById('exportNetSum');
        const vatEl = document.getElementById('exportVatSum');
        if (netEl) netEl.textContent = formatMoney(sumNet);
        if (vatEl) vatEl.textContent = formatMoney(sumVat);
        if (summaryRow) summaryRow.style.display = '';
    } catch (e) {
        if (summaryRow) summaryRow.style.display = 'none';
    }
}

function formatMoney(value) {
    if (value == null || value === '') return '';
    return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value)) + ' Kč';
}

function downloadCurrentExport(items) {
    if (!items || !items.length) return;
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.download = `export_faktury_${now}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function initExportUI() {
    const exportSection = document.getElementById('exportSection');
    if (!exportSection) return;
    const yearSelect = exportSection.querySelector('#exportYear') || exportSection.querySelector('.export-year');
    const preSelect = exportSection.querySelector('#exportPrehled');
    const periodSelect = exportSection.querySelector('#exportPeriod') || exportSection.querySelector('.export-period');
    const fetchBtn = exportSection.querySelector('#exportApplyBtn') || exportSection.querySelector('.export-fetch');
    const downloadBtn = exportSection.querySelector('#exportDownloadBtn') || exportSection.querySelector('.export-download');
    const tableBody = exportSection.querySelector('#exportTableBody') || exportSection.querySelector('.export-table-body');

    // Render button-groups for selects (if containers exist)
    try {
        const preBtns = document.getElementById('exportPrehledButtons');
        if (preBtns && preSelect) renderButtonGroupForSelect(preSelect, preBtns);
        const yearBtns = document.getElementById('exportYearButtons');
        if (yearBtns && yearSelect) renderButtonGroupForSelect(yearSelect, yearBtns);
        const periodBtns = document.getElementById('exportPeriodButtons');
        if (periodBtns && periodSelect) renderButtonGroupForSelect(periodSelect, periodBtns);
    } catch (e) { /* ignore */ }

    // Populate years and periods
    if (yearSelect) populateExportYears(yearSelect).then(() => {
        const y = yearSelect.value || (new Date()).getFullYear();
        const type = preSelect ? preSelect.value : 'all';
        const row = exportSection.querySelector('#exportPeriodRow');
        if (type === 'monthly' || type === 'quarterly') {
            if (row) row.style.display = '';
        } else {
            if (row) row.style.display = 'none';
        }
        const labelEl = exportSection.querySelector('#exportPeriodLabel');
        if (type === 'monthly') {
            if (labelEl) labelEl.textContent = 'Měsíc';
        } else if (type === 'quarterly') {
            if (labelEl) labelEl.textContent = 'Čtvrtletí';
        } else {
            if (labelEl) labelEl.textContent = 'Měsíc / Čtvrtletí';
        }
        if (periodSelect) fillPeriodOptions(periodSelect, Number(y), type === 'monthly' ? 'monthly' : (type === 'quarterly' ? 'quarterly' : 'all'));
    });

    if (yearSelect) yearSelect.addEventListener('change', () => {
        const y = Number(yearSelect.value) || (new Date()).getFullYear();
        const type = preSelect ? preSelect.value : 'all';
        if (periodSelect) fillPeriodOptions(periodSelect, y, type === 'monthly' ? 'monthly' : (type === 'quarterly' ? 'quarterly' : 'all'));
    });

    // when user changes overview type, show/hide and populate period select accordingly
    if (preSelect) preSelect.addEventListener('change', () => {
        const type = preSelect.value;
        const y = Number(yearSelect ? yearSelect.value : (new Date()).getFullYear()) || (new Date()).getFullYear();
        const row = exportSection.querySelector('#exportPeriodRow');
        const labelEl = exportSection.querySelector('#exportPeriodLabel');
        if (type === 'monthly' || type === 'quarterly') {
            if (row) row.style.display = '';
            if (periodSelect) fillPeriodOptions(periodSelect, y, type === 'monthly' ? 'monthly' : 'quarterly');
            if (type === 'monthly') { if (labelEl) labelEl.textContent = 'Měsíc'; }
            else { if (labelEl) labelEl.textContent = 'Čtvrtletí'; }
        } else {
            if (row) row.style.display = 'none';
            if (periodSelect) fillPeriodOptions(periodSelect, y, 'all');
            if (labelEl) labelEl.textContent = 'Měsíc / Čtvrtletí';
        }
    });

    let lastFetched = [];
    if (fetchBtn) fetchBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const type = preSelect ? preSelect.value : 'yearly';
        const year = yearSelect ? String(yearSelect.value) : String((new Date()).getFullYear());
        let val = null;
        if (type === 'monthly') {
            if (!periodSelect || !periodSelect.value) return alert('Vyberte měsíc');
            val = `month:${year}:${periodSelect.value}`;
        } else if (type === 'quarterly') {
            if (!periodSelect || !periodSelect.value) return alert('Vyberte čtvrtletí');
            val = `quarter:${year}:${periodSelect.value}`;
        } else {
            val = `year:${year}`;
        }
        const range = computeRange(val);
        if (!range) return alert('Neplatné období');
        const items = await fetchExportedDocs(range);
        lastFetched = items;
        renderExportTable(tableBody, items);
    });

    if (downloadBtn) downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadCurrentExport(lastFetched);
    });
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
                    img.style.cursor = 'pointer';
                    const url = `data:${mime};base64,${doc.document_base64}`;
                    img.src = url;
                    img.addEventListener('click', () => openOriginalInWindow(url));
                    img.setAttribute('alt', doc.document_filename || 'Originál');
                    imgDiv.appendChild(img);
                } else if (mime === 'application/pdf') {
                    // Wrap iframe in a relative container and put a transparent overlay to capture clicks
                    const wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '600px';
                    // show embedded PDF when base64 present, otherwise use authenticated endpoint
                    const pdfUrl = doc.document_base64 ? `data:${mime};base64,${doc.document_base64}` : (getToken() ? `/api/documents/${id}/file?token=${encodeURIComponent(getToken())}` : `/api/documents/${id}/file`);
                    iframe.src = pdfUrl;
                    wrapper.appendChild(iframe);
                    const overlay = document.createElement('div');
                    overlay.style.position = 'absolute';
                    overlay.style.left = '0';
                    overlay.style.top = '0';
                    overlay.style.width = '100%';
                    overlay.style.height = '100%';
                    overlay.style.cursor = 'pointer';
                    overlay.title = 'Otevřít originál v novém okně';
                    overlay.addEventListener('click', () => openOriginalInWindow(pdfUrl));
                    wrapper.appendChild(overlay);
                    imgDiv.appendChild(wrapper);
                } else {
                    const token = getToken();
                    const fileUrl = token ? `/api/documents/${id}/file?token=${encodeURIComponent(token)}` : `/api/documents/${id}/file`;
                    const a = document.createElement('a');
                    a.href = fileUrl;
                    a.textContent = doc.document_filename || 'Stáhnout soubor';
                    a.target = '_blank';
                    a.rel = 'noopener';
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

                // delete action removed per UX request
            } else {
                const editBtn = document.createElement('button');
                editBtn.className = 'btn-primary';
                editBtn.textContent = 'Upravit';
                editBtn.addEventListener('click', () => loadDocumentDetail(id, true));
                actionsDiv.appendChild(editBtn);

                // delete action removed per UX request
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
