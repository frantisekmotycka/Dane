# ⚡ RYCHLÝ START - OCR Čtečka Faktur

## 🎯 Jak to funguje?

Tato webová aplikace **čte faktury** pomocí OCR technologie a automaticky najde:
- 🏢 IČO
- 💰 Celkovou částku
- 💵 Částku bez DPH
- 📊 DPH sazbu a částku
- 📅 Datum

## 🚀 JAK SPUSTIT (2 KROKY)

### 1️⃣ Rozbalte ZIP

```
Pravé tlačítko na invoice-ocr-web.zip
→ Rozbalit vše
→ Vyberte cílovou složku
```

### 2️⃣ Otevřete v prohlížeči

```
Dvojklik na: index.html
```

**HOTOVO!** 🎉

Aplikace běží úplně bez instalace!

---

## 📸 Jak použít?

### Krok 1: Nahrajte fakturu
- Přetáhněte obrázek faktury
- Nebo klikněte "Vyberte soubor"

### Krok 2: Počkejte 5-15 sekund
- OCR automaticky zpracuje dokument

### Krok 3: Zkontrolujte výsledky
- Aplikace zobrazí všechny nalezené údaje
- Můžete je zkopírovat tlačítkem "Kopírovat"

---

## 💡 Tipy pro nejlepší výsledky

### ✅ POUŽÍVEJTE:
- **Kvalitní fotky** (ostré, bez rozmazání)
- **Dobré osvětlení** (bez stínů)
- **Rovně vyrovnané** dokumenty
- **PDF místo fotek** (když je to možné)

### ❌ VYHNĚTE SE:
- Rozmazaným fotkám
- Špatnému osvětlení
- Fotkám z úhlu (z boku)
- Ručně psaným fakturám

---

## 📁 Struktura

```
invoice-ocr-web/
├── index.html       ← TENTO SOUBOR OTEVŘETE!
├── css/
│   └── style.css    (styly)
├── js/
│   ├── app.js       (aplikace)
│   ├── ocr.js       (OCR modul)
│   └── parser.js    (extrakce dat)
└── README.md        (detailní dokumentace)
```

---

## 🔒 Je to bezpečné?

✅ **ANO!**
- Vše běží **offline** ve vašem prohlížeči
- **Žádná data** se neodesílají na server
- **Žádné cookies** ani sledování
- Soubory **nejsou ukládány**

---

## 🐛 Problémy?

### OCR nic nenajde?
→ Zkuste lepší kvalitu obrázku nebo PDF

### Špatně rozpoznané znaky?
→ Zvyšte rozlišení (min. 300 DPI)

### IČO se nenašlo?
→ Zkontrolujte, že je ve formátu 8 číslic

**Více řešení:** Viz [README.md](README.md)

---

## 🎓 Demo bez nahrávání

Chcete vyzkoušet bez faktury?

1. Otevřete konzoli (F12)
2. Napište: `loadDemoInvoice()`
3. Enter

---

## 📞 Dokumentace

Kompletní návod: **[README.md](README.md)**

---

## ✨ Funkce

- ✅ OCR zpracování (Tesseract.js)
- ✅ Drag & Drop upload
- ✅ Validace IČO
- ✅ Automatický výpočet
- ✅ Kopírování výsledků
- ✅ 100% offline
- ✅ Žádná instalace
- ✅ Responzivní (funguje na mobilu)

---

**Užijte si snadné čtení faktur!** 🚀

**Vytvořeno pomocí Claude AI**
