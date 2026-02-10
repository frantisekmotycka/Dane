/**
 * Parser modul pro extrakci dat z OCR textu
 * Hledá IČO, DPH, částky, data
 */

class InvoiceParser {
    constructor() {
        // Regulární výrazy pro hledání dat
        this.patterns = {
            // IČO - 8 číslic
            ico: [
                /IČO?:?\s*(\d{8})/gi,
                /IČ:?\s*(\d{8})/gi,
                /IC:?\s*(\d{8})/gi,
                /I\.?Č\.?O\.?:?\s*(\d{8})/gi,
                /Identification\s*Number:?\s*(\d{8})/gi,
                /Company\s*ID:?\s*(\d{8})/gi,
                /(?:^|\s)(\d{2}\s?\d{6})(?:\s|$)/gm,
                /(?:^|\s)(\d{8})(?:\s|$)/gm
            ],

            // DIČ
            dic: [
                /DIČ:?\s*(CZ\d{8,10})/gi,
                /DIC:?\s*(CZ\d{8,10})/gi,
                /VAT:?\s*(CZ\d{8,10})/gi
            ],

            // Celková částka
            totalAmount: [
                /(?:celkem|total|suma|k\s*úhradě|k\s*zaplacení|celková\s*částka)[\s:]*(\d[\d\s]*[,.]?\d{2})\s*(?:Kč|CZK|,-|Czk|czk)/gi,
                /(?:total|sum)[\s:]*(\d[\d\s]*[,.]?\d{2})/gi,
                /(\d[\d\s]*[,.]?\d{2})\s*(?:Kč|CZK|czk)\s*(?:celkem|total|k\s*úhradě)/gi,
                /(?:k\s*úhradě|celkem\s*k\s*úhradě)[\s:]*(\d[\d\s]*[,.]?\d{2})/gi
            ],

            // Částka bez DPH
            amountWithoutVat: [
                /(?:základ|bez\s*DPH|without\s*VAT|netto)[\s:]*(\d[\d\s]*[,.]?\d{2})\s*(?:Kč|CZK|,-)/gi,
                /(?:základní\s*částka|base\s*amount)[\s:]*(\d[\d\s]*[,.]?\d{2})/gi
            ],

            // DPH sazba
            vatRate: [
                /DPH\s*(\d{1,2})\s*%/gi,
                /VAT\s*(\d{1,2})\s*%/gi,
                /(\d{1,2})\s*%\s*DPH/gi,
                /sazba\s*DPH[\s:]*(\d{1,2})\s*%/gi
            ],

            // DPH částka
            vatAmount: [
                /DPH[\s:]*(\d[\d\s]*[,.]?\d{2})\s*(?:Kč|CZK)/gi,
                /VAT[\s:]*(\d[\d\s]*[,.]?\d{2})/gi,
                /(\d[\d\s]*[,.]?\d{2})\s*(?:Kč|CZK)\s*DPH/gi
            ],

            // Datum
            date: [
                /(?:datum|date|vystaveno|issued)[\s:]*(\d{1,2})[.\s-](\d{1,2})[.\s-](\d{2,4})/gi,
                /(\d{1,2})[.](\d{1,2})[.](\d{2,4})/g
            ]
        };
    }

    /**
     * Parsování OCR textu
     */
    parse(ocrText) {
        console.log('Parsování OCR textu...');
        
        const results = {
            ico: this.findICO(ocrText),
            dic: this.findDIC(ocrText),
            totalAmount: this.findTotalAmount(ocrText),
            amountWithoutVat: this.findAmountWithoutVat(ocrText),
            vatRate: this.findVatRate(ocrText),
            vatAmount: this.findVatAmount(ocrText),
            date: this.findDate(ocrText),
            rawText: ocrText
        };

        console.log('Parsované výsledky:', results);
        return results;
    }

    /**
     * Hledání IČO
     */
    findICO(text) {
        // Nejprve zkusíme najít IČO s popiskem
        for (const pattern of this.patterns.ico) {
            const matches = [...text.matchAll(pattern)];
            if (matches.length > 0) {
                // Ověření platnosti IČO (8 číslic)
                for (const match of matches) {
                    const ico = match[1].replace(/\s/g, '');
                    if (ico.length === 8) {
                        // Validace není nutná - může selhat u některých IČO
                        return {
                            value: ico,
                            confidence: 'high',
                            raw: match[0]
                        };
                    }
                }
            }
        }
        
        // Fallback - hledání 8-místného čísla
        const allNumbers = text.match(/\b\d{8}\b/g);
        if (allNumbers && allNumbers.length > 0) {
            // Vezmeme první 8-místné číslo
            return {
                value: allNumbers[0],
                confidence: 'medium',
                raw: allNumbers[0]
            };
        }
        
        return null;
    }

    /**
     * Validace IČO kontrolním součtem
     */
    validateICO(ico) {
        if (ico.length !== 8) return false;
        
        let sum = 0;
        for (let i = 0; i < 7; i++) {
            sum += parseInt(ico[i]) * (8 - i);
        }
        
        const mod = sum % 11;
        const checkDigit = mod === 0 ? 1 : mod === 1 ? 0 : 11 - mod;
        
        return parseInt(ico[7]) === checkDigit;
    }

    /**
     * Hledání DIČ
     */
    findDIC(text) {
        for (const pattern of this.patterns.dic) {
            const match = pattern.exec(text);
            if (match) {
                return {
                    value: match[1],
                    confidence: 'high',
                    raw: match[0]
                };
            }
        }
        return null;
    }

    /**
     * Hledání celkové částky
     */
    findTotalAmount(text) {
        // Nejprve zkusíme přesné shody s klíčovými slovy
        for (const pattern of this.patterns.totalAmount) {
            const matches = [...text.matchAll(pattern)];
            for (const match of matches) {
                const amount = this.normalizeAmount(match[1]);
                if (amount > 0) {
                    return {
                        value: amount,
                        formatted: this.formatAmount(amount),
                        confidence: 'high',
                        raw: match[0]
                    };
                }
            }
        }
        
        // Fallback - hledání všech částek a výběr největší
        const amounts = this.findAllAmounts(text);
        console.log('Nalezené částky:', amounts);
        
        if (amounts.length > 0) {
            // Seřadíme sestupně a vezmeme největší
            const sortedAmounts = amounts.sort((a, b) => b - a);
            const maxAmount = sortedAmounts[0];
            
            // Pokud je částka rozumná (>100 Kč)
            if (maxAmount >= 100) {
                return {
                    value: maxAmount,
                    formatted: this.formatAmount(maxAmount),
                    confidence: 'medium',
                    raw: maxAmount.toString()
                };
            }
        }
        
        return null;
    }

    /**
     * Hledání částky bez DPH
     */
    findAmountWithoutVat(text) {
        for (const pattern of this.patterns.amountWithoutVat) {
            const match = pattern.exec(text);
            if (match) {
                const amount = this.normalizeAmount(match[1]);
                return {
                    value: amount,
                    formatted: this.formatAmount(amount),
                    confidence: 'high',
                    raw: match[0]
                };
            }
        }
        return null;
    }

    /**
     * Hledání DPH sazby
     */
    findVatRate(text) {
        for (const pattern of this.patterns.vatRate) {
            const match = pattern.exec(text);
            if (match) {
                return {
                    value: parseInt(match[1]),
                    formatted: `${match[1]}%`,
                    confidence: 'high',
                    raw: match[0]
                };
            }
        }
        
        // Defaultní české DPH sazby
        if (text.includes('21')) return { value: 21, formatted: '21%', confidence: 'medium' };
        if (text.includes('12')) return { value: 12, formatted: '12%', confidence: 'medium' };
        if (text.includes('15')) return { value: 15, formatted: '15%', confidence: 'low' };
        
        return null;
    }

    /**
     * Hledání částky DPH
     */
    findVatAmount(text) {
        for (const pattern of this.patterns.vatAmount) {
            const match = pattern.exec(text);
            if (match) {
                const amount = this.normalizeAmount(match[1]);
                return {
                    value: amount,
                    formatted: this.formatAmount(amount),
                    confidence: 'high',
                    raw: match[0]
                };
            }
        }
        return null;
    }

    /**
     * Hledání data
     */
    findDate(text) {
        for (const pattern of this.patterns.date) {
            const match = pattern.exec(text);
            if (match) {
                const day = match[1].padStart(2, '0');
                const month = match[2].padStart(2, '0');
                let year = match[3];
                
                // Převod 2-místného roku na 4-místný
                if (year.length === 2) {
                    year = parseInt(year) > 50 ? '19' + year : '20' + year;
                }
                
                const dateStr = `${day}.${month}.${year}`;
                
                return {
                    value: dateStr,
                    formatted: dateStr,
                    confidence: 'high',
                    raw: match[0]
                };
            }
        }
        return null;
    }

    /**
     * Hledání všech částek v textu
     */
    findAllAmounts(text) {
        const amounts = [];
        
        // Vzor 1: Částky s Kč/CZK
        const pattern1 = /(\d[\d\s]*[,.]?\d{2})\s*(?:Kč|CZK|czk|,-)/gi;
        let match;
        while ((match = pattern1.exec(text)) !== null) {
            const amount = this.normalizeAmount(match[1]);
            if (amount > 0) {
                amounts.push(amount);
            }
        }
        
        // Vzor 2: Částky ve formátu "123 456,78" i bez měny
        const pattern2 = /\b(\d{1,3}(?:\s\d{3})*[,]\d{2})\b/g;
        while ((match = pattern2.exec(text)) !== null) {
            const amount = this.normalizeAmount(match[1]);
            if (amount > 0 && !amounts.includes(amount)) {
                amounts.push(amount);
            }
        }
        
        // Vzor 3: Částky ve formátu "123456.78" nebo "123456,78"
        const pattern3 = /\b(\d{3,}[,.]\d{2})\b/g;
        while ((match = pattern3.exec(text)) !== null) {
            const amount = this.normalizeAmount(match[1]);
            if (amount > 0 && !amounts.includes(amount)) {
                amounts.push(amount);
            }
        }
        
        return amounts;
    }

    /**
     * Normalizace částky (odstranění mezer, převod čárky na tečku)
     */
    normalizeAmount(amountStr) {
        if (!amountStr) return 0;
        
        // Odstranění mezer a převod čárky na tečku
        const normalized = amountStr
            .replace(/\s/g, '')
            .replace(',', '.');
        
        return parseFloat(normalized) || 0;
    }

    /**
     * Formátování částky pro zobrazení
     */
    formatAmount(amount) {
        if (!amount) return '0,00 Kč';
        
        return new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    /**
     * Výpočet chybějících hodnot na základě známých
     */
    calculateMissingValues(results) {
        // Pokud máme celkovou částku a DPH sazbu, můžeme vypočítat ostatní
        if (results.totalAmount && results.vatRate && !results.amountWithoutVat) {
            const total = results.totalAmount.value;
            const vatRate = results.vatRate.value / 100;
            const withoutVat = total / (1 + vatRate);
            
            results.amountWithoutVat = {
                value: withoutVat,
                formatted: this.formatAmount(withoutVat),
                confidence: 'calculated'
            };
            
            results.vatAmount = {
                value: total - withoutVat,
                formatted: this.formatAmount(total - withoutVat),
                confidence: 'calculated'
            };
        }
        
        return results;
    }
}

// Export instance
const invoiceParser = new InvoiceParser();
