import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

export const ROTAS_MENU = [
  { nome: 'inicio', caminho: '/', rotulo: 'Início', icone: 'Home' },
  { nome: 'concursos', caminho: '/concursos', rotulo: 'Concursos', icone: 'Landmark' },
  { nome: 'disciplinas', caminho: '/disciplinas', rotulo: 'Disciplinas', icone: 'BookOpen' },
  { nome: 'cronograma', caminho: '/cronograma', rotulo: 'Cronograma', icone: 'CalendarRange' },
  { nome: 'estudos', caminho: '/estudos', rotulo: 'Estudos', icone: 'Timer' },
  { nome: 'questoes', caminho: '/questoes', rotulo: 'Questões', icone: 'ListChecks' },
  { nome: 'erros', caminho: '/erros', rotulo: 'Caderno de erros', icone: 'NotebookPen' },
  { nome: 'flashcards', caminho: '/flashcards', rotulo: 'Flashcards', icone: 'Layers' },
  { nome: 'desempenho', caminho: '/desempenho', rotulo: 'Desempenho', icone: 'BarChart3' },
  { nome: 'calendario', caminho: '/calendario', rotulo: 'Calendário', icone: 'CalendarDays' },
  { nome: 'configuracoes', caminho: '/configuracoes', rotulo: 'Configurações', icone: 'Settings' }
] as const

const rotas: RouteRecordRaw[] = [
  { path: '/', name: 'inicio', component: () => import('@/views/InicioView.vue'), meta: { titulo: 'Início' } },
  { path: '/concursos', name: 'concursos', component: () => import('@/views/ConcursosView.vue'), meta: { titulo: 'Concursos' } },
  { path: '/concursos/:id', name: 'concurso', component: () => import('@/views/ConcursoDetalheView.vue'), meta: { titulo: 'Concurso', pai: 'concursos' } },
  { path: '/disciplinas', name: 'disciplinas', component: () => import('@/views/DisciplinasView.vue'), meta: { titulo: 'Disciplinas' } },
  { path: '/cronograma', name: 'cronograma', component: () => import('@/views/CronogramaView.vue'), meta: { titulo: 'Cronograma' } },
  { path: '/estudos', name: 'estudos', component: () => import('@/views/EstudosView.vue'), meta: { titulo: 'Estudos' } },
  { path: '/questoes', name: 'questoes', component: () => import('@/views/QuestoesView.vue'), meta: { titulo: 'Questões' } },
  { path: '/erros', name: 'erros', component: () => import('@/views/ErrosView.vue'), meta: { titulo: 'Caderno de erros' } },
  { path: '/flashcards', name: 'flashcards', component: () => import('@/views/FlashcardsView.vue'), meta: { titulo: 'Flashcards' } },
  { path: '/flashcards/revisar', name: 'revisar', component: () => import('@/views/RevisaoView.vue'), meta: { titulo: 'Revisão', pai: 'flashcards' } },
  { path: '/desempenho', name: 'desempenho', component: () => import('@/views/DesempenhoView.vue'), meta: { titulo: 'Desempenho' } },
  { path: '/calendario', name: 'calendario', component: () => import('@/views/CalendarioView.vue'), meta: { titulo: 'Calendário' } },
  { path: '/configuracoes', name: 'configuracoes', component: () => import('@/views/ConfiguracoesView.vue'), meta: { titulo: 'Configurações' } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

/** Hash history funciona em qualquer hospedagem estática, sem regras de reescrita no servidor. */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: rotas,
  scrollBehavior: () => ({ top: 0 })
})

router.afterEach((to) => {
  document.title = `${(to.meta.titulo as string) ?? 'Estudos'} · Estudos para Concursos`
})
