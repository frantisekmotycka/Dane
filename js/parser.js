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
            // supplier/recipient specific fields
            supplierIc: this.findSupplierICO(ocrText),
            recipientIc: this.findRecipientICO(ocrText),
            supplierDic: this.findSupplierDIC(ocrText),
            recipientDic: this.findRecipientDIC(ocrText),
            totalAmount: this.findTotalAmount(ocrText),
            amountWithoutVat: this.findAmountWithoutVat(ocrText),
            vatRate: this.findVatRate(ocrText),
            vatAmount: this.findVatAmount(ocrText),
            date: this.findDate(ocrText),
            rawText: ocrText
        };

        // Attach IC-DIC pairs for downstream use and possible disambiguation
        const pairs = this.findICDICPairs(ocrText, 300);
        results.icDicPairs = pairs;

        // Helper to extract primitive value from result entries
        const val = (x) => {
            if (!x) return null;
            return (typeof x === 'object') ? (x.value || null) : x;
        };

        // If supplier and recipient ended up the same (which should not happen),
        // try to pick distinct pairs by proximity to the 'Dodavatel' and 'Odběratel' blocks.
        try {
            const supVal = val(results.supplierIc) || val(results.supplierIco) || val(results.ico);
            const recVal = val(results.recipientIc) || val(results.recipientIco) || null;

            const supDicVal = val(results.supplierDic) || val(results.dic) || null;
            const recDicVal = val(results.recipientDic) || null;

            const sameIc = supVal && recVal && supVal === recVal;
            const sameDic = supDicVal && recDicVal && supDicVal === recDicVal;

            if ((sameIc || sameDic) && pairs && pairs.length > 0) {
                // find block starts
                const supBlock = this.findBlockBetween(ocrText, /Dodavatel:?/i, [/Odběratel:?/i, /Platební|Datum|Fakturuji/gi]);
                const recBlock = this.findBlockBetween(ocrText, /Odběratel:?/i, [/Platební|Datum|Fakturuji|Dodavatel/gi]);
                const supStart = supBlock ? supBlock.startIdx : 0;
                const recStart = recBlock ? recBlock.startIdx : 0;

                // score pairs by distance to block starts
                const scoreFor = (blockStart) => {
                    const scored = pairs.map((p, idx) => {
                        const anchor = (p.icoIndex != null) ? p.icoIndex : (p.dicIndex != null ? p.dicIndex : 0);
                        return { idx, dist: Math.abs(anchor - blockStart), pair: p };
                    }).sort((a, b) => a.dist - b.dist);
                    return scored;
                };

                const supScores = scoreFor(supStart);
                const recScores = scoreFor(recStart);

                // pick best for supplier
                const supChoice = supScores.length > 0 ? supScores[0] : null;
                // pick best for recipient that is not the same pair as supplier
                let recChoice = null;
                for (const s of recScores) {
                    if (!supChoice || s.idx !== supChoice.idx) { recChoice = s; break; }
                }

                // If recipient didn't find a different pair, and there is a second-best for supplier, swap
                if (!recChoice && supScores.length > 1) {
                    // give supplier the closest and recipient the next one
                    recChoice = supScores[1];
                }

                if (supChoice) {
                    const p = supChoice.pair;
                    if (p.ico) results.supplierIc = { value: p.ico, confidence: 'high', raw: 'paired' };
                    if (p.dic) results.supplierDic = { value: p.dic, confidence: 'high', raw: 'paired' };
                }

                if (recChoice) {
                    const p = recChoice.pair;
                    if (p.ico) results.recipientIc = { value: p.ico, confidence: 'high', raw: 'paired' };
                    if (p.dic) results.recipientDic = { value: p.dic, confidence: 'high', raw: 'paired' };
                }

                // Ensure DIČ are distinct — if both sides got the same DIČ, try to pick an alternative DIČ
                try {
                    const dicsList = this.findAllDICMatches(ocrText) || [];
                    const supDicVal = results.supplierDic && (results.supplierDic.value || results.supplierDic);
                    const recDicVal = results.recipientDic && (results.recipientDic.value || results.recipientDic);

                    if (supDicVal && recDicVal && supDicVal === recDicVal && dicsList.length > 1) {
                        // prefer DIČ that is closest to supplier start but not equal to recipient's DIČ
                        const alternatives = dicsList
                            .filter(d => d.value !== recDicVal)
                            .map(d => ({ d, dist: Math.abs(d.index - supStart) }))
                            .sort((a, b) => a.dist - b.dist);

                        if (alternatives.length > 0) {
                            results.supplierDic = { value: alternatives[0].d.value, confidence: 'high', raw: 'paired-alt' };
                        }
                    }
                } catch (e) {}

                // Ensure IČ are distinct — if both sides got the same IČ, try to pick an alternative IČ
                try {
                    const supIcoVal = results.supplierIc && (results.supplierIc.value || results.supplierIc);
                    const recIcoVal = results.recipientIc && (results.recipientIc.value || results.recipientIc);

                    if (supIcoVal && recIcoVal && supIcoVal === recIcoVal && pairs.length > 1) {
                        // find a pair with different ICO for recipient, prefer closest to recipient block
                        const alternatives = pairs
                            .map((p, idx) => ({ p, idx, dist: Math.abs(((p.icoIndex!=null)?p.icoIndex:(p.dicIndex||0)) - recStart) }))
                            .filter(x => x.p.ico && x.p.ico !== supIcoVal)
                            .sort((a, b) => a.dist - b.dist);

                        if (alternatives.length > 0) {
                            const choice = alternatives[0].p;
                            results.recipientIc = { value: choice.ico, confidence: 'high', raw: 'paired-alt' };
                            if (choice.dic) results.recipientDic = { value: choice.dic, confidence: 'high', raw: 'paired-alt' };
                        } else {
                            // fallback: pick any pair with different ico
                            for (const p of pairs) {
                                if (p.ico && p.ico !== supIcoVal) {
                                    results.recipientIc = { value: p.ico, confidence: 'medium', raw: 'fallback-alt' };
                                    if (p.dic) results.recipientDic = { value: p.dic, confidence: 'medium', raw: 'fallback-alt' };
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {
            // don't break parsing on disambiguation errors
            console.warn('Error during supplier/recipient disambiguation', e);
        }

        // Post-processing: derive IČ from DIČ if useful and prefer validated IČs
        try {
            const getVal = v => { if (!v) return null; return (typeof v === 'object') ? (v.value || null) : v; };
            const supIc = getVal(results.supplierIc) || null;
            let recIc = getVal(results.recipientIc) || null;
            const supDic = getVal(results.supplierDic) || getVal(results.dic) || null;
            const recDic = getVal(results.recipientDic) || null;

            // helper: extract 8-digit ICO from DIC like CZ04365259 or plain digits
            const normalizeDicToIco = (d) => {
                if (!d) return null;
                const s = String(d).toUpperCase().replace(/[^0-9A-Z]/g, '');
                // match optional CZ prefix followed by 8 digits at end
                const m = s.match(/(?:CZ)?(\d{8})$/i);
                if (m) return m[1];
                // fallback: last 8 digits
                const last8 = s.match(/(\d{8})$/);
                return last8 ? last8[1] : null;
            };

            // If recipient IČ missing or equals supplier, try derive from recipient DIČ
            if ((!recIc || recIc === supIc) && recDic) {
                const derived = normalizeDicToIco(recDic);
                if (derived) {
                    if (this.validateICO(derived)) {
                        results.recipientIc = { value: derived, confidence: 'high', raw: 'derived-from-dic' };
                    } else {
                        results.recipientIc = { value: derived, confidence: 'medium', raw: 'derived-from-dic' };
                    }
                    recIc = derived;
                }
            }

            // If still equal or missing, prefer any validated IČ from pairs for recipient
            if ((!recIc || recIc === supIc) && results.icDicPairs && results.icDicPairs.length > 0) {
                // try to find a pair with a validated ico different from supplier
                let found = null;
                for (const p of results.icDicPairs) {
                    if (p.ico && p.ico !== supIc && this.validateICO(p.ico)) { found = p; break; }
                }
                if (!found) {
                    // fallback: any pair with different ico
                    for (const p of results.icDicPairs) {
                        if (p.ico && p.ico !== supIc) { found = p; break; }
                    }
                }
                if (found) {
                    results.recipientIc = { value: found.ico, confidence: 'high', raw: 'paired-derived' };
                    if (found.dic) results.recipientDic = { value: found.dic, confidence: 'high', raw: 'paired-derived' };
                }
            }
        } catch (e) {
            console.warn('Error during post-processing IČ/DIČ derivation', e);
        }

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
     * Pomocná funkce: najde první shodu patternu v okolí klíčového slova
     */
    findNearby(text, keywordRegex, patternRegex, windowChars = 400) {
        const keywordMatch = keywordRegex.exec(text);
        if (keywordMatch) {
            const idx = keywordMatch.index;
            const slice = text.substr(idx, windowChars);
            const m = patternRegex.exec(slice);
            if (m) return m[1].replace(/\s/g, '');
        }
        return null;
    }

    /**
     * Najde textový blok mezi dvěma klíčovými slovy (pokud existují)
     */
    findBlockBetween(text, startRegex, endRegexes) {
        const startMatch = startRegex.exec(text);
        if (!startMatch) return null;
        const startIdx = startMatch.index + startMatch[0].length;

        // najdeme nejbližší end index po startIdx
        let endIdx = text.length;
        for (const r of endRegexes) {
            const m = r.exec(text);
            if (m && m.index > startIdx && m.index < endIdx) {
                endIdx = m.index;
            }
        }

        const blockText = text.substring(startIdx, endIdx).trim();
        return { text: blockText, startIdx, endIdx };
    }

    /**
     * Hledá IČ dodavatele v blízkosti slova 'Dodavatel' nebo 'Supplier'
     */
    findSupplierICO(text) {
        // Pokusíme se najít páry IČ/DIČ v textu a vybrat ten nejbližší k 'Dodavatel'
        const pairs = this.findICDICPairs(text, 200);
        if (pairs.length > 0) {
            const supplierBlockObj = this.findBlockBetween(text, /Dodavatel:?/i, [/Odběratel:?/i, /Platební|Datum|Fakturuji/gi]);
            if (supplierBlockObj) {
                // najdeme nejbližší pár podle pozice prvního výskytu v bloku
                const blockStart = supplierBlockObj.startIdx;
                let best = null;
                let bestDist = Infinity;
                for (const p of pairs) {
                    if (p.icoIndex == null) continue;
                    const dist = Math.abs(p.icoIndex - blockStart);
                    if (dist < bestDist) { bestDist = dist; best = p; }
                }
                if (best) return { value: best.ico, confidence: 'high', raw: 'supplier-pair' };
            }

            // fallback: první pár, nebo první ICO
            if (pairs[0].ico) return { value: pairs[0].ico, confidence: 'medium', raw: 'fallback-pair-first' };
            const icoAll = this.findAllICOs(text);
            if (icoAll.length >= 1) return { value: icoAll[0], confidence: 'medium', raw: 'fallback-first' };
        }

        return null;
    }

    /**
     * Hledá IČ odběratele v blízkosti slov 'Odběratel', 'Kupující' nebo 'Recipient'
     */
    findRecipientICO(text) {
        const pairs = this.findICDICPairs(text, 200);
        if (pairs.length > 0) {
            const recipientBlockObj = this.findBlockBetween(text, /Odběratel:?/i, [/Platební|Datum|Fakturuji|Dodavatel/gi]);
            if (recipientBlockObj) {
                const blockStart = recipientBlockObj.startIdx;
                let best = null;
                let bestDist = Infinity;
                for (const p of pairs) {
                    if (p.icoIndex == null) continue;
                    const dist = Math.abs(p.icoIndex - blockStart);
                    if (dist < bestDist) { bestDist = dist; best = p; }
                }
                if (best) return { value: best.ico, confidence: 'high', raw: 'recipient-pair' };
            }

            // fallback: pokud jsou dvě páry, vezmeme druhý pár
            if (pairs.length >= 2 && pairs[1].ico) return { value: pairs[1].ico, confidence: 'medium', raw: 'fallback-pair-second' };
            const icoAll = this.findAllICOs(text);
            if (icoAll.length >= 2) return { value: icoAll[1], confidence: 'medium', raw: 'fallback-second' };
        }

        return null;
    }

    /**
     * Najde všechna 8-místná IČ v textu (jednoduchý helper)
     */
    findAllICOs(text) {
        const matches = text.match(/\b\d{8}\b/g);
        return matches ? matches.map(m => m.replace(/\s/g, '')) : [];
    }

    /**
     * Najde všechny výskyty IČ s pozicí
     */
    findAllICMatches(text) {
        const res = [];
        const re = /\b(\d{8})\b/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            // Skip numbers that are likely invoice numbers or variable symbols
            const contextBefore = text.substring(Math.max(0, m.index - 40), m.index).toLowerCase();
            const contextAfter = text.substring(m.index + m[1].length, m.index + m[1].length + 40).toLowerCase();
            const invoiceIndicators = /(faktura|fakturu|variabiln|variabilní|variabilni|variab|variab\.symbol|variabiln&iacute;|variabiln&iacute;|variabilnÍ|variabilnÍ|variabilnÍ symbol|variabilnÍ symbol:|číslo\s*účtu|účet|variabilnÍ|variabilnÍ)/i;

            // If surrounding context contains invoice-related keywords, skip this 8-digit match
            if (invoiceIndicators.test(contextBefore) || invoiceIndicators.test(contextAfter)) {
                continue;
            }

            res.push({ value: m[1].replace(/\s/g, ''), index: m.index });
        }
        return res;
    }

    /**
     * Najde všechny výskyty DIČ s pozicí
     */
    findAllDICMatches(text) {
        const res = [];
        const re = /DIČ:?[\s]*((?:CZ)?\d{8,10})/gi;
        let m;
        while ((m = re.exec(text)) !== null) {
            res.push({ value: m[1], index: m.index });
        }
        return res;
    }

    /**
     * Spojí IČ a DIČ do párů pokud jsou blízko sebe
     */
    findICDICPairs(text, maxDistance = 200) {
        const icos = this.findAllICMatches(text);
        const dics = this.findAllDICMatches(text);
        const pairs = [];

        for (const ico of icos) {
            // najdeme nejbližší DIČ podle indexu
            let best = null;
            let bestDist = Infinity;
            for (const dic of dics) {
                const dist = Math.abs(dic.index - ico.index);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = dic;
                }
            }

            if (best && bestDist <= maxDistance) {
                pairs.push({ ico: ico.value, dic: best.value, icoIndex: ico.index, dicIndex: best.index, dist: bestDist });
            } else {
                pairs.push({ ico: ico.value, dic: null, icoIndex: ico.index, dicIndex: null, dist: null });
            }
        }

        // Debug log pairs
        try {
            console.log('IC-DIC pairs:', pairs);
        } catch (e) {}
        return pairs;
    }
    
    // Debug: vypis pairs při vývoji
    // (volitelně lze odstranit)
    // Note: keep minimal to avoid spam

    /**
     * Hledání DIČ dodavatele poblíž 'Dodavatel'
     */
    findSupplierDIC(text) {
        // nejprve zkusíme páry
        const pairs = this.findICDICPairs(text, 200);
        if (pairs.length > 0) {
            const supplierBlockObj = this.findBlockBetween(text, /Dodavatel:?/i, [/Odběratel:?/i, /Platební|Datum|Fakturuji/gi]);
            if (supplierBlockObj) {
                const blockStart = supplierBlockObj.startIdx;
                let best = null;
                let bestDist = Infinity;
                for (const p of pairs) {
                    if (p.dicIndex == null) continue;
                    const dist = Math.abs(p.dicIndex - blockStart);
                    if (dist < bestDist) { bestDist = dist; best = p; }
                }
                if (best && best.dic) return { value: best.dic, confidence: 'high', raw: 'supplier-pair' };
            }
            // fallback: any dic
            const any = this.findDIC(text);
            return any || null;
        }
        return this.findDIC(text);
    }

    /**
     * Hledání DIČ odběratele poblíž 'Odběratel' nebo 'Kupující'
     */
    findRecipientDIC(text) {
        const pairs = this.findICDICPairs(text, 200);
        if (pairs.length > 0) {
            const recipientBlockObj = this.findBlockBetween(text, /Odběratel:?/i, [/Platební|Datum|Fakturuji|Dodavatel/gi]);
            if (recipientBlockObj) {
                const blockStart = recipientBlockObj.startIdx;
                let best = null;
                let bestDist = Infinity;
                for (const p of pairs) {
                    if (p.dicIndex == null) continue;
                    const dist = Math.abs(p.dicIndex - blockStart);
                    if (dist < bestDist) { bestDist = dist; best = p; }
                }
                if (best && best.dic) return { value: best.dic, confidence: 'high', raw: 'recipient-pair' };
            }

            // fallback: pokud existují více DIČ, vezmeme druhý
            const matches = [...text.matchAll(/DIČ:?[\s]*((?:CZ)?\d{8,10})/gi)].map(m => m[1]);
            if (matches.length >= 2) return { value: matches[1], confidence: 'medium', raw: 'fallback-second' };
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
