import { load, save } from "./storage.js";

export const LOCALES = [
    { code: "en", label: "EN", name: "English" },
    { code: "es", label: "ES", name: "Español" },
    { code: "pt", label: "PT", name: "Português" }
];

const strings = {

    en: {
        appName: "The Coffee Deck",
        navSearch: "Search",
        navSearchLabel: "Search and filter",
        navStudy: "Study",
        navStudyLabel: "Study mode",
        navProgress: "Progress",
        navProgressLabel: "Your progress",
        cardCount: n => `${n} Cards`,
        searchPlaceholder: "Search cards...",
        clear: "Clear",
        noResults: "No cards match your search.",
        previousCard: "Previous card",
        nextCard: "Next card",
        bookmark: "Bookmark",
        removeBookmark: "Remove bookmark",
        close: "Close",

        sectionDefinition: "Definition",
        sectionWhy: "Why it Matters",
        sectionTip: "Pro Tip",
        sectionMistake: "Common Mistake",
        sectionChallenge: "Challenge",
        sectionRelated: "Related Cards",

        studyModeTitle: "Study Mode",
        shuffleSession: "Shuffle session",
        studyWhySection: "Why it matters",
        studyTipSection: "Pro tip",
        studyMistakeSection: "Common mistake",
        studyChallengeSection: "Challenge",
        thinkFirst: "Think of the answer first.",
        pressReveal: "Press reveal when ready.",
        reveal: "Reveal",
        hide: "Hide",
        exitStudyMode: "Exit study mode",
        ratingAgain: "Again",
        ratingHard: "Hard",
        ratingGood: "Good",
        ratingEasy: "Easy",
        ratingAgainHint: "<1 min",
        ratingHardHint: "~3 days",
        ratingGoodHint: "~1 week",
        ratingEasyHint: "2+ weeks",
        sessionComplete: "Session complete",
        youStudiedPrefix: "You studied",
        youStudiedSuffix: n => (n === 1 ? "card." : "cards."),
        studyAgain: "Study again",
        returnHome: "Return home",

        reviewsLabel: n => `Reviews: ${n}`,
        resetProgress: "Reset progress",
        rateInStudyMode: "Rate your recall in Study Mode to schedule reviews.",
        stateNew: "New",
        stateLearning: "Learning",
        stateReview: "Reviewing",
        stateMastered: "Mastered",

        statsTitle: "Your progress",
        libraryHeading: "Library",
        totalCards: "Total Cards",
        bookmarks: "Bookmarks",
        export: "Export",
        recentlyViewed: "Recently Viewed",
        dueToday: "Due Today",
        progressHeading: "Progress",
        dayStreak: "Day Streak",
        totalReviews: "Total Reviews",
        mastered: "Mastered",
        completion: "Completion",
        activityHeading: "Activity, Last 12 Weeks",
        mostStudied: "Most Studied",
        strongest: "Strongest",
        needsWork: "Needs Work",
        reviewsSuffix: n => `${n} reviews`,
        easeSuffix: n => `${n} ease`,
        studyFewCards: "Study a few cards to see category breakdowns here.",
        recentActivity: "Recent Activity",
        notEnoughData: "Not enough data yet.",
        heatmapTooltip: (date, count) => `${date}: ${count} review${count === 1 ? "" : "s"}`,

        languageLabel: "Language",

        welcomeEyebrow: "Welcome",
        welcomeTitle: "The Coffee Deck",
        welcomeTagline: "A flashcard app built for coffee professionals — 120 topics across espresso, milk, filter, roasting, sensory, green coffee, processing, origin, equipment, workflow and business, in one place.",
        welcomeFeature1Title: "Browse",
        welcomeFeature1Desc: "Swipe or tap the arrows to move through the deck. Tap a card to see the full definition, why it matters, a pro tip, a common mistake and a challenge.",
        welcomeFeature2Title: "Study",
        welcomeFeature2Desc: "Open Study Mode for spaced-repetition review — rate how well you knew each card and it schedules your next review automatically.",
        welcomeFeature3Title: "Bookmark",
        welcomeFeature3Desc: "Save any card to revisit later, and export your bookmarks whenever you like.",
        welcomeFeature4Title: "Track progress",
        welcomeFeature4Desc: "See your streak, mastery and review history any time in Progress.",
        welcomeCta: "Get started",
        welcomeAbout: "About"
    },

    es: {
        appName: "The Coffee Deck",
        navSearch: "Buscar",
        navSearchLabel: "Buscar y filtrar",
        navStudy: "Estudiar",
        navStudyLabel: "Modo estudio",
        navProgress: "Progreso",
        navProgressLabel: "Tu progreso",
        cardCount: n => `${n} tarjetas`,
        searchPlaceholder: "Buscar tarjetas...",
        clear: "Borrar",
        noResults: "Ninguna tarjeta coincide con tu búsqueda.",
        previousCard: "Tarjeta anterior",
        nextCard: "Siguiente tarjeta",
        bookmark: "Guardar",
        removeBookmark: "Quitar marcador",
        close: "Cerrar",

        sectionDefinition: "Definición",
        sectionWhy: "Por qué importa",
        sectionTip: "Consejo profesional",
        sectionMistake: "Error común",
        sectionChallenge: "Desafío",
        sectionRelated: "Tarjetas relacionadas",

        studyModeTitle: "Modo estudio",
        shuffleSession: "Mezclar sesión",
        studyWhySection: "Por qué importa",
        studyTipSection: "Consejo profesional",
        studyMistakeSection: "Error común",
        studyChallengeSection: "Desafío",
        thinkFirst: "Piensa primero en la respuesta.",
        pressReveal: "Pulsa revelar cuando estés listo.",
        reveal: "Revelar",
        hide: "Ocultar",
        exitStudyMode: "Salir del modo estudio",
        ratingAgain: "Repetir",
        ratingHard: "Difícil",
        ratingGood: "Bien",
        ratingEasy: "Fácil",
        ratingAgainHint: "<1 min",
        ratingHardHint: "~3 días",
        ratingGoodHint: "~1 semana",
        ratingEasyHint: "2+ semanas",
        sessionComplete: "Sesión completa",
        youStudiedPrefix: "Has estudiado",
        youStudiedSuffix: n => (n === 1 ? "tarjeta." : "tarjetas."),
        studyAgain: "Estudiar de nuevo",
        returnHome: "Volver al inicio",

        reviewsLabel: n => `Repasos: ${n}`,
        resetProgress: "Reiniciar progreso",
        rateInStudyMode: "Califica tu recuerdo en el modo estudio para programar repasos.",
        stateNew: "Nueva",
        stateLearning: "Aprendiendo",
        stateReview: "Repasando",
        stateMastered: "Dominada",

        statsTitle: "Tu progreso",
        libraryHeading: "Biblioteca",
        totalCards: "Tarjetas totales",
        bookmarks: "Guardadas",
        export: "Exportar",
        recentlyViewed: "Vistas recientemente",
        dueToday: "Pendientes hoy",
        progressHeading: "Progreso",
        dayStreak: "Días seguidos",
        totalReviews: "Repasos totales",
        mastered: "Dominadas",
        completion: "Completado",
        activityHeading: "Actividad, últimas 12 semanas",
        mostStudied: "Más estudiadas",
        strongest: "Más fuertes",
        needsWork: "A reforzar",
        reviewsSuffix: n => `${n} repasos`,
        easeSuffix: n => `${n} facilidad`,
        studyFewCards: "Estudia algunas tarjetas para ver el desglose por categoría aquí.",
        recentActivity: "Actividad reciente",
        notEnoughData: "Aún no hay suficientes datos.",
        heatmapTooltip: (date, count) => `${date}: ${count} repaso${count === 1 ? "" : "s"}`,

        languageLabel: "Idioma",

        welcomeEyebrow: "Bienvenido",
        welcomeTitle: "The Coffee Deck",
        welcomeTagline: "Una app de tarjetas para profesionales del café: 120 temas de espresso, leche, filtro, tueste, análisis sensorial, café verde, procesamiento, origen, equipos, flujo de trabajo y negocio, todo en un solo lugar.",
        welcomeFeature1Title: "Explora",
        welcomeFeature1Desc: "Desliza o toca las flechas para recorrer las tarjetas. Toca una tarjeta para ver la definición completa, por qué importa, un consejo profesional, un error común y un desafío.",
        welcomeFeature2Title: "Estudia",
        welcomeFeature2Desc: "Abre el Modo estudio para repaso espaciado: califica cuánto recordabas cada tarjeta y programa tu próximo repaso automáticamente.",
        welcomeFeature3Title: "Guarda",
        welcomeFeature3Desc: "Guarda cualquier tarjeta para verla más tarde y exporta tus tarjetas guardadas cuando quieras.",
        welcomeFeature4Title: "Sigue tu progreso",
        welcomeFeature4Desc: "Consulta tu racha, dominio e historial de repasos en cualquier momento en Progreso.",
        welcomeCta: "Empezar",
        welcomeAbout: "Acerca de"
    },

    pt: {
        appName: "The Coffee Deck",
        navSearch: "Buscar",
        navSearchLabel: "Buscar e filtrar",
        navStudy: "Estudar",
        navStudyLabel: "Modo estudo",
        navProgress: "Progresso",
        navProgressLabel: "Seu progresso",
        cardCount: n => `${n} cartões`,
        searchPlaceholder: "Buscar cartões...",
        clear: "Limpar",
        noResults: "Nenhum cartão corresponde à sua busca.",
        previousCard: "Cartão anterior",
        nextCard: "Próximo cartão",
        bookmark: "Salvar",
        removeBookmark: "Remover marcador",
        close: "Fechar",

        sectionDefinition: "Definição",
        sectionWhy: "Por que importa",
        sectionTip: "Dica profissional",
        sectionMistake: "Erro comum",
        sectionChallenge: "Desafio",
        sectionRelated: "Cartões relacionados",

        studyModeTitle: "Modo estudo",
        shuffleSession: "Embaralhar sessão",
        studyWhySection: "Por que importa",
        studyTipSection: "Dica profissional",
        studyMistakeSection: "Erro comum",
        studyChallengeSection: "Desafio",
        thinkFirst: "Pense na resposta primeiro.",
        pressReveal: "Toque em revelar quando estiver pronto.",
        reveal: "Revelar",
        hide: "Ocultar",
        exitStudyMode: "Sair do modo estudo",
        ratingAgain: "De novo",
        ratingHard: "Difícil",
        ratingGood: "Bom",
        ratingEasy: "Fácil",
        ratingAgainHint: "<1 min",
        ratingHardHint: "~3 dias",
        ratingGoodHint: "~1 semana",
        ratingEasyHint: "2+ semanas",
        sessionComplete: "Sessão concluída",
        youStudiedPrefix: "Você estudou",
        youStudiedSuffix: n => (n === 1 ? "cartão." : "cartões."),
        studyAgain: "Estudar de novo",
        returnHome: "Voltar ao início",

        reviewsLabel: n => `Revisões: ${n}`,
        resetProgress: "Reiniciar progresso",
        rateInStudyMode: "Avalie sua lembrança no Modo Estudo para agendar revisões.",
        stateNew: "Novo",
        stateLearning: "Aprendendo",
        stateReview: "Revisando",
        stateMastered: "Dominado",

        statsTitle: "Seu progresso",
        libraryHeading: "Biblioteca",
        totalCards: "Total de cartões",
        bookmarks: "Salvos",
        export: "Exportar",
        recentlyViewed: "Vistos recentemente",
        dueToday: "Pendentes hoje",
        progressHeading: "Progresso",
        dayStreak: "Dias seguidos",
        totalReviews: "Revisões totais",
        mastered: "Dominados",
        completion: "Conclusão",
        activityHeading: "Atividade, últimas 12 semanas",
        mostStudied: "Mais estudados",
        strongest: "Mais fortes",
        needsWork: "Precisa reforçar",
        reviewsSuffix: n => `${n} revisões`,
        easeSuffix: n => `${n} facilidade`,
        studyFewCards: "Estude alguns cartões para ver o resumo por categoria aqui.",
        recentActivity: "Atividade recente",
        notEnoughData: "Ainda não há dados suficientes.",
        heatmapTooltip: (date, count) => `${date}: ${count} revisõe${count === 1 ? "" : "s"}`,

        languageLabel: "Idioma",

        welcomeEyebrow: "Bem-vindo",
        welcomeTitle: "The Coffee Deck",
        welcomeTagline: "Um app de cartões para profissionais do café: 120 temas de espresso, leite, filtrado, torra, avaliação sensorial, café verde, processamento, origem, equipamentos, fluxo de trabalho e negócio, tudo em um só lugar.",
        welcomeFeature1Title: "Explore",
        welcomeFeature1Desc: "Deslize ou toque nas setas para percorrer os cartões. Toque em um cartão para ver a definição completa, por que importa, uma dica profissional, um erro comum e um desafio.",
        welcomeFeature2Title: "Estude",
        welcomeFeature2Desc: "Abra o Modo estudo para revisão espaçada: avalie sua lembrança de cada cartão e as próximas revisões são agendadas automaticamente.",
        welcomeFeature3Title: "Salve",
        welcomeFeature3Desc: "Salve qualquer cartão para ver depois e exporte seus cartões salvos quando quiser.",
        welcomeFeature4Title: "Acompanhe seu progresso",
        welcomeFeature4Desc: "Veja sua sequência, domínio e histórico de revisões a qualquer momento em Progresso.",
        welcomeCta: "Começar",
        welcomeAbout: "Sobre"
    }

};

let currentLocale = load("locale", "en");

if (!strings[currentLocale]) {

    currentLocale = "en";

}

const listeners = [];

export function getLocale() {

    return currentLocale;

}

export function setLocale(code) {

    if (!strings[code] || code === currentLocale) return;

    currentLocale = code;

    save("locale", code);

    listeners.forEach(fn => fn(code));

}

export function onLocaleChange(fn) {

    listeners.push(fn);

}

export function t(key, ...args) {

    const table = strings[currentLocale] || strings.en;

    const value = table[key] ?? strings.en[key];

    if (typeof value === "function") {

        return value(...args);

    }

    return value ?? key;

}
