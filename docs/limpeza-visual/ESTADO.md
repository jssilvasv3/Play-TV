# Estado da limpeza visual

Registro do piloto solicitado para a área de Termos de Uso e Privacidade.
O escopo aprovado foi somente esta área, sem migração das outras telas.

Fase atual: piloto aprovado; escopo encerrado
Branch: `limpeza-visual-termos-privacidade`
Referência visual: Amazon Prime Video
Tema e destaque aprovados: escuro e azul
Referência no código: `app.js` (`openTermsModal`) e `styles.css` (`.modal.terms-modal`)

| Área | Escopo | Estado | Observações |
|---|---|---|---|
| Termos de Uso & Privacidade | Modal, estilos e regra da área em DESIGN.md | concluída | Conteúdo e comportamento preservados |

| Estado | Tema | Largura | Situação |
|---|---|---|---|
| Termos, início do conteúdo | escuro | desktop, 1280 px | Capturada e inspecionada |
| Termos, início do conteúdo | escuro | celular, 390 px | Capturada e inspecionada |

Decisões:
- Somente o escopo dos Termos foi alterado.
- O corpo do texto passou de 12,5 px para 14 px.
- O overflow horizontal de 6 px no celular foi corrigido.
- O texto jurídico foi mantido sem reescrita.

Pendência informativa:
- Os Termos afirmam que não há coleta de dados pessoais, mas a telemetria do produto envia e registra ID de dispositivo, IP e localização para o painel administrativo. A afirmação foi preservada; a divergência requer revisão de produto/jurídico.

Não verificado:
- Outros navegadores e dispositivos físicos.
- Estados de teclado/foco além da abertura do modal.
- Outras áreas do produto, fora do escopo solicitado.
