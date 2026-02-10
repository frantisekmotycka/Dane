# 📄 OCR Čtečka Faktur - Webová aplikace

Jednoduchá webová aplikace pro automatické čtení faktur a účtenek pomocí OCR technologie.

## ✨ Funkce

- ✅ **OCR zpracování** - Automatické rozpoznání textu z obrázků a PDF
- ✅ **Extrakce dat** - Nalezení IČO, DPH, částek a data
- ✅ **Drag & Drop** - Jednoduché nahrání souboru přetažením
- ✅ **Validace IČO** - Kontrolní součet pro české IČO
- ✅ **Automatický výpočet** - Dopočítání chybějících hodnot
- ✅ **Kopírování výsledků** - Export do schránky
- ✅ **Náhled dokumentu** - Zobrazení nahraného obrázku
- ✅ **Responsivní design** - Funguje na mobilu i počítači

## 🚀 Spuštění

### Varianta 0: Ukládání do databáze (doporučeno pro nový modul)

Pro přihlášení uživatelů a ukládání výsledků do SQLite je potřeba spustit lokální server:

```bash
python server.py
```

Poté otevřete: `http://localhost:8000`

### Varianta 1: Otevření v prohlížeči (NEJJEDNODUŠŠÍ)

1. **Rozbalte složku `invoice-ocr-web`**

2. **Otevřete `index.html` v prohlížeči**
   - Dvojklik na soubor `index.html`
   - NEBO pravé tlačítko → Otevřít v → Chrome/Firefox/Edge

3. **Hotovo!** Aplikace běží offline ve vašem prohlížeči

**POZNÁMKA:** Funguje úplně bez serveru! Vše běží lokálně.

### Varianta 2: Lokální web server (pro vývoj)

Pokud chcete použít lokální server:

```bash
# Python 3
python -m http.server 8000

# Nebo Node.js
npx serve

# Nebo PHP
php -S localhost:8000
```

Pak otevřete: `http://localhost:8000`

## 📖 Jak používat

### 1. Nahrajte fakturu

**Způsob A - Drag & Drop:**
- Přetáhněte obrázek faktury na upload zónu

**Způsob B - Výběr souboru:**
- Klikněte na "Vyberte soubor"
- Vyberte obrázek nebo PDF

### 2. Počkejte na zpracování

- OCR analýza trvá 5-15 sekund
- Zobrazí se progress

### 3. Zkontrolujte výsledky

Aplikace najde a zobrazí:
- 🏢 **IČO** (s validací kontrolního součtu)
- 💰 **Celková částka**
- 💵 **Částka bez DPH**
- 📊 **DPH sazba** (21%, 12%, 15%)
- 💳 **Částka DPH**
- 📅 **Datum vystavení**

### 4. Použijte výsledky

- **Kopírovat** - Zkopíruje všechny údaje do schránky
- **Zobrazit raw text** - Ukáže celý rozpoznaný text
- **Nahrát další** - Reset pro nový dokument

## 🎯 Tipy pro nejlepší výsledky

### ✅ DO:
- Používejte **kvalitní** fotky/skeny (min. 300 DPI)
- Zajistěte **dobrý kontrast** (černý text, bílý papír)
- **Rovně** vyrovnané dokumenty
- **Ostré** fotky bez rozmazání
- Preferujte **PDF** před fotkami

### ❌ NEDĚLEJTE:
- Rozmazané nebo neostrý fotky
- Špatné osvětlení (stíny, reflexe)
- Zkreslené úhly (fotka z boku)
- Příliš malé rozlišení
- Ručně psané faktury

## 📁 Struktura projektu

```
invoice-ocr-web/
├── index.html          # Hlavní HTML stránka
├── css/
│   └── style.css       # Styly
├── js/
│   ├── app.js          # Hlavní aplikace
│   ├── ocr.js          # OCR modul (Tesseract)
│   └── parser.js       # Parser pro extrakci dat
└── README.md           # Tento soubor
```

## 🔧 Technologie

- **HTML5, CSS3, JavaScript** - Čistý vanilla JS, žádný framework
- **Tesseract.js** - OCR engine (přes CDN)
- **100% offline** - Vše běží v prohlížeči
- **Žádná instalace** - Stačí otevřít HTML

## 📝 Podporované formáty

- ✅ **JPG / JPEG** - Obrázky
- ✅ **PNG** - Obrázky
- ✅ **PDF** - Dokumenty

Max. velikost: **10 MB**

## 🛠️ Rozšíření a úpravy

### Přidání dalších polí

V `js/parser.js` přidejte nový pattern:

```javascript
this.patterns.newField = [
    /pattern1/gi,
    /pattern2/gi
];
```

V `js/parser.js` vytvořte metodu:

```javascript
findNewField(text) {
    // Vaše logika
}
```

V `index.html` přidejte nové pole:

```html
<div class="result-card">
    <div class="result-label">
        <span class="icon">🆕</span>
        <span>Nové pole</span>
    </div>
    <div class="result-value" id="newFieldValue">Nenalezeno</div>
</div>
```

### Změna jazyka OCR

V `js/ocr.js` změňte jazyk:

```javascript
// Místo 'ces' použijte:
await this.worker.loadLanguage('eng'); // Angličtina
await this.worker.initialize('eng');
```

Dostupné jazyky: https://github.com/tesseract-ocr/tessdata

## 🐛 Řešení problémů

### Problém: OCR nic nenajde

**Řešení:**
1. Zkontrolujte kvalitu obrázku
2. Zkuste sken místo fotky
3. Zvyšte kontrast obrázku před nahráním
4. Ujistěte se, že je text čitelný

### Problém: Špatně rozpoznané znaky

**Řešení:**
1. Použijte vyšší rozlišení (min. 300 DPI)
2. Zajistěte lepší osvětlení
3. Vyčistěte/upravte obrázek (kontrast, jas)

### Problém: IČO se nenašlo

**Řešení:**
1. Zkontrolujte, že je na faktuře uvedeno
2. Ujistěte se, že je ve formátu 8 číslic
3. IČO musí mít správný kontrolní součet

### Problém: Částky nejsou správně

**Řešení:**
1. Zkontrolujte, že částky mají formát: "1 234,56 Kč"
2. Text musí obsahovat klíčová slova: "celkem", "DPH", "základ"
3. Upravte regex v `parser.js` pro váš formát

## 📊 Přesnost OCR

Tesseract.js má obvykle:
- **90-95%** přesnost na kvalitních dokumentech
- **70-85%** přesnost na fotkách z mobilu
- **95-99%** přesnost na PDF vytvořených počítačem

## 🔒 Soukromí

- ✅ **100% offline** - Nic se neodesílá na server
- ✅ **Žádné cookies** - Aplikace nesbírá data
- ✅ **Lokální zpracování** - Vše se děje ve vašem prohlížeči
- ✅ **Bezpečné** - Soubory nejsou nikam ukládány

## 📄 Licence

MIT License - Použijte jak chcete!

## 🎓 Demo

Pro rychlé vyzkoušení bez nahrávání souboru:

1. Otevřete konzoli prohlížeče (F12)
2. Napište: `loadDemoInvoice()`
3. Ukáže se demo s testovacími daty

## 💡 Další vývoj

Možná vylepšení:
- [ ] Export do CSV/Excel
- [ ] Uložení do databáze (lokální IndexedDB)
- [ ] Historie načtených faktur
- [ ] Batch processing (více faktur najednou)
- [ ] Automatická kategorizace (AI/ML)
- [ ] OCR více jazyků současně
- [ ] Detekce typu dokumentu (faktura vs účtenka)
- [ ] Export do účetních systémů

## 📞 Podpora

Pro problémy nebo dotazy:
- Otevřete issue na GitHubu
- Nebo kontaktujte vývojáře

---

**Vytvořeno s ❤️ pomocí Claude AI**

**Verze:** 1.0.0  
**Datum:** Únor 2024
