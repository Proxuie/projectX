# API платформы

Базовый префикс — `/api`. Формат — JSON. Авторизация — cookie-сессия
(`express-session`). Ошибки: `{ "error": "текст" }` и соответствующий HTTP-код.

Роли проверяются по **активной** роли пользователя. Смена роли —
`POST /api/me/role`.

## Авторизация

| Метод | Путь | Описание |
|---|---|---|
| POST | `/auth/login` | Вход: `{ login, password }` |
| POST | `/auth/logout` | Выход |
| POST | `/auth/register` | Регистрация спортсмена (согласие обязательно) |
| GET | `/me` | Текущий пользователь, активная роль, непрочитанные |
| POST | `/me/role` | Переключение роли: `{ role }` |
| GET | `/dictionaries` | Справочники (дисциплины, группы, разряды, типы) |

## Реестр

| Метод | Путь | Описание |
|---|---|---|
| GET | `/users` | Список с фильтрами `role, q, discipline, org, rank, age, municipality` |
| GET | `/users/:id` | Карточка: тренеры, результаты, заявки, справки |
| POST | `/users` | Создание пользователя (федерация) |
| PUT | `/users/:id` | Редактирование (федерация — полностью, пользователь — свой профиль) |
| GET | `/organizations` | Организации с числом спортсменов |
| POST | `/organizations` | Создание организации |
| PUT | `/organizations/:id` | Редактирование организации |

## Дашборд

| Метод | Путь | Описание |
|---|---|---|
| GET | `/dashboard` | KPI, ближайшие события, «требует внимания», сроки, график |

## Соревнования и заявки

| Метод | Путь | Описание |
|---|---|---|
| GET | `/competitions` | Календарь с фильтрами |
| POST | `/competitions` | Создание (федерация) |
| GET | `/competitions/:id` | Карточка: заявка пользователя, судьи, протокол |
| PUT | `/competitions/:id` | Редактирование |
| POST | `/competitions/:id/status` | Смена статуса `{ status }` |
| GET | `/competitions/:id/regulation` | Положение (HTML) |
| GET | `/competitions/:id/applications` | Заявки соревнования |
| GET | `/competitions/:id/results` | Результаты |
| POST | `/competitions/:id/results` | Ввод результатов `{ rows: [...] }` |
| POST | `/competitions/:id/protocol` | Сформировать протокол |
| GET | `/applications` | Заявки (скоуп по роли) |
| POST | `/applications` | Подать заявку `{ competitionId, athleteId? }` |
| POST | `/applications/:id/approve` | Одобрить |
| POST | `/applications/:id/reject` | Отклонить `{ comment }` |
| DELETE | `/applications/:id` | Отозвать свою заявку |

## Протоколы

| Метод | Путь | Описание |
|---|---|---|
| GET | `/protocols/:id` | Протокол с участниками |
| POST | `/protocols/:id/publish` | Публикация, результаты в историю |
| GET | `/protocols/:id/docx` | Выгрузка `.docx` |

## Разряды

| Метод | Путь | Описание |
|---|---|---|
| GET | `/ranks/applications` | Заявки (скоуп по роли) |
| POST | `/ranks/applications` | Подать заявку |
| POST | `/ranks/applications/:id/approve` | Присвоить `{ orderNumber, validUntil }` |
| POST | `/ranks/applications/:id/reject` | Отклонить |
| GET | `/ranks/expiring` | Истекающие и истёкшие разряды |

## Судьи

| Метод | Путь | Описание |
|---|---|---|
| GET | `/judges` | Реестр судей |
| GET | `/judges/assignments` | Назначения (`competitionId`, `judgeId`) |
| POST | `/judges/assignments` | Назначить судью |
| DELETE | `/judges/assignments/:id` | Снять назначение |
| GET | `/judges/category-applications` | Заявки на категорию |
| POST | `/judges/category-applications` | Подать заявку (судья) |
| POST | `/judges/category-applications/:id/approve` | Присвоить |
| POST | `/judges/category-applications/:id/reject` | Отклонить |

## Рейтинг и сборная

| Метод | Путь | Описание |
|---|---|---|
| GET | `/rating` | Рейтинг: `discipline, ageGroup, minRank` |
| GET | `/teams` | Составы сборной |
| POST | `/teams` | Сохранить состав |
| GET | `/teams/:id/order.docx` | Проект приказа |

## Отчёты и справки

| Метод | Путь | Описание |
|---|---|---|
| GET | `/reports/headcount.xlsx` | Численность, `years=2024,2025,2026` |
| GET | `/reports/registry.xlsx` | Реестр спортсменов |
| GET | `/reports/rating.xlsx` | Рейтинг |
| GET | `/reports/athlete/:id.docx` | Отчёт о соревнованиях спортсмена |
| GET | `/reports/judges/:competitionId.docx` | Справка о судейской коллегии |
| GET | `/reports/judge/:id.docx` | Отчёт о соревнованиях судьи |
| GET | `/certificates` | Справки об участии |
| POST | `/certificates` | Сформировать справку |
| GET | `/certificates/:id/qr` | QR-код (data URL) |
| GET | `/verify/:code` | Публичная проверка справки |

## Привязки тренеров

| Метод | Путь | Описание |
|---|---|---|
| GET | `/trainer-links` | Привязки (скоуп по роли) |
| POST | `/trainer-links` | Запрос тренера `{ athleteId, discipline }` |
| POST | `/trainer-links/:id/confirm` | Подтверждение спортсменом |
| POST | `/trainer-links/:id/decline` | Отклонение или завершение |

## Прочее

| Метод | Путь | Описание |
|---|---|---|
| GET | `/notifications` | Уведомления пользователя |
| POST | `/notifications/:id/read` | Прочитать |
| POST | `/notifications/read-all` | Прочитать все |
| GET | `/audit` | Журнал действий (федерация) |
| GET | `/settings` | Настройки |
| PUT | `/settings` | Изменить настройки (федерация) |
| GET | `/public/landing` | Публичные данные навигатора |
