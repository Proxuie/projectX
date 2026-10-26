# Модель данных

Хранилище — `data/db.json`. Коллекции — массивы объектов. Даты — строки
`YYYY-MM-DD`, идентификаторы — `u_1`, `c_3`, `app_12` и т.п. Счётчики id лежат в
`counters`.

## users

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | Идентификатор |
| `login` | string | Логин (уникальный) |
| `passHash` | string | bcrypt-хеш пароля |
| `fio` | string | ФИО |
| `birthDate` | date | Дата рождения |
| `gender` | `m` / `f` | Пол |
| `municipality` | string | Муниципалитет |
| `organizationId` | string | Организация |
| `disciplines` | string[] | Коды дисциплин |
| `startYear` | number | Год начала занятий |
| `roles` | string[] | `athlete`, `trainer`, `judge`, `federation`, `ministry` |
| `activeRole` | string | Роль по умолчанию |
| `status` | `active` / `disqualified` | Статус |
| `consent` | object | `{ pdp, date, guardianFio, guardianConsent }` |
| `rusada` | object | `{ passed, date, certUrl }` |
| `rank` | object? | `{ title, date, orderNumber, validUntil }` |
| `judgeCategory` | object? | `{ title, validUntil }` |

## organizations

`{ id, name, type, license, municipality, programs: [{ stage, disciplines }] }`

## competitions

`{ id, title, discipline, level, typeId, ageGroup, gender, startDate, endDate,
place, format, status, regulationUrl, calendarPlan, calendarNumber,
applicationDeadline, createdBy, createdAt }`

- `level`: `champ_ru`, `perv_ru`, `interregional`, `regional`.
- `format`: `offline`, `online`, `mixed`.
- `status`: `draft`, `published`, `registration`, `closed`, `finished`.
- `calendarPlan`: `ekp`, `regional`, `null`.

## applications

`{ id, competitionId, athleteId, submittedBy, status, comment, createdAt, decidedAt }`

Статусы: `pending`, `approved`, `rejected`, `withdrawn`.

## results

`{ id, competitionId, athleteId, place, points, protocolId }`

## protocols

`{ id, competitionId, status, rows: [{ line, athleteId, fio, organization, place,
points }], createdAt, publishedAt }`

Протокол хранит снимок участников и результатов.

## rankApplications

`{ id, athleteId, requestedRank, competitionId, resultId, status, comment,
createdAt, decidedAt, decidedBy, orderNumber, validUntil }`

## judgeAssignments

`{ id, competitionId, judgeId, position }`

## judgeCategoryApplications

`{ id, judgeId, requestedCategory, status, comment, createdAt, decidedAt, validUntil }`

## trainerLinks

`{ id, trainerId, athleteId, discipline, status, history: [{ status, date, by }] }`

Статусы: `pending`, `active`, `paused`, `ended`.

## teams

`{ id, season, discipline, ageGroup, athleteIds, createdAt, createdBy }`

## certificates

`{ id, number, athleteId, competitionId, resultId, verifyCode, createdAt }`

## notifications

`{ id, userId, title, text, link, read, createdAt, channel }`

## auditLog

`{ id, at, userId, login, action, entity, entityId, details }`

## settings

`{ season, ratingPoints, stabilityCoeff, rankValidityYears,
judgeCategoryValidityYears, rankRules, premiyaDeadline }`

`ratingPoints`: `{ champ_ru: [100,80,60], perv_ru: [80,60,40],
interregional: [60,45,30], regional: [40,30,20] }`.

## dictionaries

`{ disciplines, ageGroups, ranks, judgeCategories, competitionTypes }`

Дисциплины: `algo`, `product`, `security`, `ai`, `robotics`, `uav`.
Возрастные группы: `10-13`, `14-17`, `18-21`, `22+`.

## Связи

```
organizations 1—* users
competitions 1—* applications *—1 users (athlete)
competitions 1—* results *—1 users
competitions 1—1 protocols
users 1—* rankApplications *—1 results
competitions 1—* judgeAssignments *—1 users (judge)
users 1—* trainerLinks *—1 users
```
