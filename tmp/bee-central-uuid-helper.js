/**
 * UUID Helper
 * Função helper para gerar UUID compatível com todos os navegadores
 */

function generateUUID() {
    // Tenta usar crypto.randomUUID() se disponível (navegadores modernos)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    
    // Fallback: gera UUID v4 usando crypto.getRandomValues() ou Math.random()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r, v;
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            // Usa crypto.getRandomValues() se disponível
            var array = new Uint8Array(1);
            crypto.getRandomValues(array);
            r = array[0] % 16;
        } else {
            // Fallback para Math.random()
            r = Math.random() * 16;
        }
        v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

