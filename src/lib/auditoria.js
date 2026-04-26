import { supabase } from './supabase'

/**
 * Registra uma entrada no log de auditoria.
 * @param {Object} opts
 * @param {string} opts.tabela        - nome da tabela afetada
 * @param {string} opts.registro_id   - id do registro afetado
 * @param {string} opts.acao          - 'criar' | 'editar' | 'remover' | 'login' etc.
 * @param {string} opts.descricao     - descrição legível da operação
 * @param {any}    opts.valor_anterior - valor antes da mudança (objeto)
 * @param {any}    opts.valor_novo     - valor após a mudança (objeto)
 * @param {string} opts.usuario_id
 * @param {string} opts.usuario_nome
 */
export async function registrarAuditoria({ tabela, registro_id, acao, descricao, valor_anterior, valor_novo, usuario_id, usuario_nome }) {
  try {
    await supabase.from('auditoria').insert({
      tabela,
      registro_id: registro_id ? String(registro_id) : null,
      acao,
      descricao,
      valor_anterior: valor_anterior ? JSON.stringify(valor_anterior) : null,
      valor_novo: valor_novo ? JSON.stringify(valor_novo) : null,
      usuario_id,
      usuario_nome,
    })
  } catch (e) {
    // Auditoria nunca deve quebrar a operação principal
    console.warn('Auditoria falhou:', e)
  }
}
