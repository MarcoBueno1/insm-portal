// src/lib/pix.js
// Geração de payload Pix (BR Code / EMV) 100% client-side
// Padrão BACEN — sem API externa, sem custo

function crc16(str) {
  let crc = 0xffff
  const bytes = new TextEncoder().encode(str)
  for (const byte of bytes) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0')
}

function emv(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

/**
 * Gera o payload EMV do Pix Estático
 * @param {object} opts
 * @param {string} opts.chave       - Chave Pix (CPF, CNPJ, e-mail, tel ou aleatória)
 * @param {string} opts.nome        - Nome do recebedor (max 25 chars)
 * @param {string} opts.cidade      - Cidade do recebedor (max 15 chars)
 * @param {number} opts.valor       - Valor em reais (ex: 35.90)
 * @param {string} [opts.txid]      - ID da transação (max 25 chars alfanumérico)
 * @param {string} [opts.descricao] - Descrição opcional (max 72 chars)
 * @returns {string} Payload EMV pronto para gerar QR Code
 */
export function gerarPixPayload({ chave, nome, cidade, valor, txid, descricao }) {
  // Remove acentos (exigência do padrão Pix)
  const clean = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const nomeClean   = clean(nome).substring(0, 25)
  const cidadeClean = clean(cidade).substring(0, 15)
  const txidClean   = (txid || 'INSMPEDIDO').replace(/[^A-Za-z0-9]/g, '').substring(0, 25) || '***'
  const valorStr    = Number(valor).toFixed(2)

  // Merchant Account Information (ID 26)
  const gui   = emv('00', 'BR.GOV.BCB.PIX')
  const chaveF = emv('01', chave)
  const descF  = descricao ? emv('02', clean(descricao).substring(0, 72)) : ''
  const merchantAccount = emv('26', gui + chaveF + descF)

  const payload =
    emv('00', '01') +               // Payload Format Indicator
    emv('01', '12') +               // Point of Initiation: 12 = reutilizável
    merchantAccount +
    emv('52', '0000') +             // Merchant Category Code
    emv('53', '986') +              // Transaction Currency: BRL
    emv('54', valorStr) +           // Transaction Amount
    emv('58', 'BR') +               // Country Code
    emv('59', nomeClean) +          // Merchant Name
    emv('60', cidadeClean) +        // Merchant City
    emv('62', emv('05', txidClean)) // Additional Data Field (TXID)

  const semCRC = payload + '6304'
  return semCRC + crc16(semCRC)
}

/**
 * URL de QR Code via api.qrserver.com (serviço público, gratuito, sem chave)
 */
export function pixQrCodeUrl(payload, size = 300) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}&ecc=M`
}

/**
 * Gera TXID único baseado no ID do pedido
 */
export function gerarTxId(pedidoId) {
  return ('INSM' + pedidoId.replace(/-/g, '').toUpperCase()).substring(0, 25)
}
