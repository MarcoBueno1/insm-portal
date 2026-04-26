/**
 * Formata uma string de data (YYYY-MM-DD) para o formato localizado pt-BR.
 * @param {string} dataString - A data em formato string (ex: "2026-04-27")
 * @returns {string} Data formatada (ex: "segunda-feira, 27 de abril de 2026")
 */
export function formatarData(dataString) {
  if (!dataString) return '—';
  
  // Adiciona T00:00:00 para evitar problemas de fuso horário ao criar o objeto Date
  const data = new Date(dataString + 'T00:00:00');
  
  return data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Abre o Google Calendar em uma nova aba com os detalhes do evento preenchidos.
 * @param {Object} evento - Objeto contendo titulo, dataInicio, dataFim, descricao e local.
 */
export function abrirGoogleCalendar(evento) {
  if (!evento || !evento.titulo || !evento.dataInicio) {
    console.warn("Dados insuficientes para abrir o Google Calendar.");
    return;
  }
  
  const inicio = new Date(evento.dataInicio);
  // Se não houver data de fim, assume 1 hora de duração
  const fim = evento.dataFim 
    ? new Date(evento.dataFim) 
    : new Date(inicio.getTime() + 60 * 60 * 1000); 
  
  // Formata para o padrão ISO sem hífens, dois-pontos ou pontos (ex: 20260427T100000Z)
  const formatarParaGoogle = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  
  const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evento.titulo)}&dates=${formatarParaGoogle(inicio)}/${formatarParaGoogle(fim)}&details=${encodeURIComponent(evento.descricao || '')}&location=${encodeURIComponent(evento.local || '')}`;
  
  window.open(url, '_blank');
}
