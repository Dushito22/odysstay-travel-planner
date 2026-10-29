import { useCallback } from "react";

import { useLang } from "./i18n";

/** Interface strings outside the landing page. English is the key; a missing entry shows the English. */
export const RU: Record<string, string> = {
  // navigation and shells
  Discover: "Поиск", Map: "Карта", Deals: "Сделки", Inbox: "Входящие", Saved: "Избранное", Profile: "Профиль",
  Documents: "Документы", "Sign out": "Выйти", Explore: "Обзор", Pricing: "Тарифы", Privacy: "Конфиденциальность",
  Terms: "Условия", "Back to Discover": "Назад к поиску", "Try again": "Повторить",
  // listing page
  "Key numbers": "Главные цифры", "Location and what is nearby": "Расположение и что рядом", "In plain words": "Простыми словами",
  "Every fact in the notice": "Каждый факт из объявления", "Quoted from the official notice": "Цитаты из официального объявления",
  "Original notice": "Оригинал объявления", "Official documents": "Официальные документы", "Filed with the court": "Поданы в суд",
  "Who runs the sale": "Кто проводит продажу", Renovation: "Ремонт", "Estimated ranges": "Оценка в диапазонах",
  "Total cost picture": "Полная картина расходов", "How buying works": "Как проходит покупка", "Red flags": "Тревожные сигналы",
  "Found in the court appraisal report": "Найдено в отчёте судебного оценщика",
  "Base price": "Начальная цена", "Minimum offer": "Минимальная ставка", "Court appraisal": "Оценка суда", Surface: "Площадь",
  Condition: "Состояние", "Price per m²": "Цена за м²", Deposit: "Залог", "Sale date": "Дата торгов", "Offer deadline": "Срок подачи заявки",
  "Deal score": "Оценка сделки", "Tap for reasons": "Нажмите, чтобы увидеть причины", "Offers valid from": "Ставки принимаются от",
  "Start a deal": "Начать сделку", "Sign in to start a deal": "Войдите, чтобы начать сделку", "Open your deal": "Открыть вашу сделку",
  "Ask the agent about this property": "Спросить Аргоса об этом объекте", "Unknown comune": "Коммуна не указана",
  "Location not stated": "Расположение не указано", "Listing not found": "Объявление не найдено",
  "It may have been withdrawn or the link is wrong.": "Возможно, его сняли с продажи или ссылка неверна.",
  "Official photo from the court listing": "Официальное фото из объявления суда",
  "No coordinates in the notice.": "В объявлении нет координат.",
  // who runs the sale
  "Argos can contact them for you": "Аргос свяжется с ними за вас",
  "Argos writes to the sale delegate, the notary or the agency in Italian, on your behalf. He asks for the viewing, the documents and the exact rules, then brings you the answer in your language. You read every message before it goes out.":
    "Аргос напишет делегату продажи, нотариусу или агентству по-итальянски от вашего имени. Он запросит осмотр, документы и точные правила, а затем расскажет вам ответ на вашем языке. Каждое письмо вы читаете до отправки.",
  "Let Argos contact them": "Поручить Аргосу связаться",
  "Sign in to let Argos contact them": "Войдите, чтобы Аргос мог связаться",
  "Or reach them yourself": "Или свяжитесь сами",
  // gallery and render
  "Imagine it renovated": "Представить после ремонта", "Create illustration": "Создать иллюстрацию",
  "Creating, this takes up to a minute": "Создаём, это займёт до минуты",
  "Every image is labelled as an illustration.": "Каждое изображение подписано как иллюстрация.",
  "Describe what you want (optional)": "Опишите, что хотите (необязательно)",
  "Sign in to create": "Войдите, чтобы создать",
  "Free accounts can create one illustration. Pro is unlimited.": "Бесплатный аккаунт может создать одну иллюстрацию. В Pro без ограничений.",
  "No photos yet": "Пока нет фото",
  "Satellite view · no photos published": "Вид со спутника · фото не опубликованы",
  // cards and filters
  "View →": "Открыть →", "offers from": "ставки от", "Surface not stated": "Площадь не указана", Vacant: "Свободно", Occupied: "Занято",
  "In budget": "В рамках бюджета", "Your regions": "Ваши регионы", "Every open house in Italy,": "Дома в Италии на продажу:",
  Region: "Регион", "Max price": "Макс. цена", "Property type": "Тип объекта", "Min surface m²": "Мин. площадь, м²",
  "Sale type": "Тип продажи", Status: "Статус", "Below court appraisal": "Ниже оценки суда", Filters: "Фильтры",
  "State of the property": "Состояние объекта", "Total ruin": "Руина", "Needs fixing": "Нужен ремонт", "Ready to live in": "Можно жить",
  "Real photos only": "Только с настоящими фото", "Hide court-scan photos": "Скрыть сканы из суда",
  "Any price": "Любая цена", "Any size": "Любая площадь", "Min score": "Мин. оценка",
  "Best deals": "Лучшие предложения", Cheapest: "Подешевле", "Closing soon": "Скоро закроются", "Furthest below appraisal": "Сильнее всего ниже оценки", Newest: "Новые", "For you": "Для вас", "Deal score ": "Оценка ",
  Sale: "Продажа", Concession: "Концессия", Lease: "Аренда", "One-euro scheme": "Дом за €1", "Court auction": "Судебные торги",
  "Notary auction": "Торги у нотариуса", "Other sale": "Другая продажа", House: "Дом", Apartment: "Квартира", Building: "Здание",
  "Rural house": "Загородный дом", Land: "Земля", Commercial: "Коммерческая", Garage: "Гараж", Mixed: "Смешанный", Other: "Другое",
  "€1 scheme": "Дом за €1", "Save this search": "Сохранить поиск", "Using your preferences,": "По вашим предпочтениям,", reset: "сбросить",
  Closed: "Закрыто", "Closes today": "Закрывается сегодня", "below valuation": "ниже оценки", Demo: "Демо",
  // login
  "Sign in to Odysstay": "Вход в Odysstay", Email: "Эл. почта", "Email me a link": "Отправить ссылку на почту",
  "Check your inbox": "Проверьте почту", "Use a different email": "Использовать другую почту",
  // pricing
  "Simple pricing": "Простые тарифы", "Free to explore. Pay only when you're working several properties at once.": "Смотреть бесплатно. Платите, только когда ведёте несколько объектов сразу.",
  Free: "Бесплатно", Pro: "Pro", "Start free": "Начать бесплатно", "Join the Pro waitlist": "Встать в очередь на Pro",
  "Explore Italy's hidden market and work one property properly.": "Изучайте скрытый рынок Италии и доведите до конца один объект.",
  "For buyers working several properties at once.": "Для покупателей, ведущих несколько объектов сразу.",
  "National feed and map": "Лента и карта по всей Италии", "Full listing pages, every fact sourced from the notice": "Полные страницы объектов, каждый факт со ссылкой на объявление",
  "Agent chat on any listing": "Чат с Аргосом по любому объекту", "1 active deal with plan, messages and quotes": "1 активная сделка с планом, письмами и расчётами",
  "1 illustration to try it": "1 иллюстрация, чтобы попробовать", "Saved searches with email alerts": "Сохранённые поиски с уведомлениями на почту",
  "Everything in Free": "Всё из бесплатного тарифа", "Unlimited active deals": "Сколько угодно активных сделок",
  "Unlimited Italian drafting and follow-ups": "Письма и напоминания по-итальянски без ограничений", "Unlimited illustrations": "Иллюстрации без ограничений",
  "Instant alerts when a matching notice appears": "Мгновенные уведомления о подходящих объявлениях", "Priority processing of new notices": "Приоритетная обработка новых объявлений",
  "Fees to the comune, notary, surveyor or other professionals are paid by you directly to them. Odysstay never holds your money.":
    "Сборы коммуне, нотариусу, оценщику и другим специалистам вы платите им напрямую. Odysstay никогда не держит ваши деньги.",
};

export function useT() {
  const lang = useLang();
  return useCallback((s: string) => (lang === "ru" ? RU[s] ?? s : s), [lang]);
}
