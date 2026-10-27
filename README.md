# Estudos para Concursos

Aplicativo pessoal (PWA) para organizar estudos de concursos públicos: concursos, disciplinas e tópicos, cronograma (dia/semana/mês), cronômetro, questões, caderno de erros, flashcards com repetição espaçada (FSRS), relatórios, calendário, metas, backup em JSON e exportação do cronograma em PDF/PNG.

**Stack:** Vue 3 (`<script setup>`) · TypeScript estrito · Vite · Vue Router (hash) · Pinia · Tailwind CSS · Lucide · Apache ECharts · Dexie/IndexedDB · ts-fsrs · Vitest · Playwright · vite-plugin-pwa.

## Requisitos
Node.js 20 ou superior.

## Instalação e execução
```bash
npm ci              # instala as dependências (usa o package-lock.json)
npm run dev         # desenvolvimento em http://localhost:5173
npm test            # testes unitários e de integração (Vitest)
npm run build       # checagem de tipos + build de produção em dist/
npm run preview     # serve dist/ em http://localhost:4173
npm run test:e2e    # testes de interface (Playwright, constrói e serve o app)
```
Para o e2e é preciso um Chromium do Playwright (`npx playwright install chromium`). Se já houver um instalado, aponte-o com `PW_CHROMIUM_PATH=/caminho/do/chromium npm run test:e2e`.

## Deploy (hospedagem estática com HTTPS)
1. `npm ci && npm run build`
2. Publique **o conteúdo da pasta `dist/`** em qualquer hospedagem estática com HTTPS (Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3+CDN…). Não há backend nem variáveis de ambiente.
3. O app usa rotas por hash (`/#/cronograma`) e caminhos relativos (`base: './'`), então funciona na raiz ou em subpasta, sem regras de reescrita.
4. HTTPS é necessário para instalar como PWA e para o service worker (localhost também funciona).

## Dados, offline e backup
- Tudo fica no **IndexedDB do navegador, neste dispositivo**. Não há sincronização entre aparelhos nesta versão.
- Funciona offline depois da primeira visita (service worker com pré-cache dos arquivos do próprio app; não mexe em caches de outros apps do mesmo domínio).
- **Configurações → Backup**: exporta/importa JSON. A importação valida estrutura, tipos e referências, mostra um resumo e pede confirmação antes de substituir; a substituição é uma transação única (se falhar, nada muda).
- Formato do backup: `formatoVersao: 1`. Para evoluir, incremente `FORMATO_ATUAL` e registre a migração em `MIGRACOES` (`src/services/backup.ts`). Alterações no banco: adicione `this.version(2).stores(...).upgrade(...)` em `src/db/database.ts`.
- No iOS, o Safari pode limpar dados de sites pouco usados; instale na tela inicial e faça backups periódicos. O cronômetro usa timestamps, então recupera o tempo ao reabrir o app (iOS não executa em segundo plano nem envia notificações).

## Estrutura
```
src/components   componentes reutilizáveis      src/services   regras de negócio puras (testadas)
src/composables  lógica reutilizável            src/stores     estado global (Pinia)
src/db           Dexie + camada de repositório  src/types      tipos do domínio
src/layouts      layout/navegação               src/utils      datas, validação, ids
src/router       rotas                          src/views      páginas
tests            Vitest                         e2e            Playwright
```

## Decisões de modelo
- Disciplina é cadastrada uma vez e vinculada a concursos por `concursoDisciplinas` (N:N).
- Cada **sessão de estudo** pertence a no máximo um concurso; **blocos de questões, erros e flashcards** podem se associar a vários concursos por lista de ids, sem duplicar conteúdo e sem contagem dupla nos totais gerais.
- Pular uma atividade não a conclui nem a apaga; datas planejada, reagendada e real são campos distintos; o histórico de alterações é registrado.
- Metas têm vigência (`desde`): mudar a meta vale daqui para frente e não reclassifica dias passados.
- Repetição espaçada: **FSRS** real, via `ts-fsrs`.
- Exportação: o planner é renderizado fora da tela e convertido em imagem (`html-to-image`); o PDF (`jspdf`) é A4 retrato/paisagem com uma imagem por página, então o texto no PDF não é selecionável.
