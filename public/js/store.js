// Общее состояние приложения.
export const state = {
  me: null,
  role: null,
  unread: 0,
  dict: null
};

export function discName(code) {
  if (!state.dict) return code;
  const d = state.dict.disciplines.find((x) => x.code === code);
  return d ? d.name : code;
}

export function levelName(level) {
  const map = {
    champ_ru: 'Чемпионат России',
    perv_ru: 'Первенство России',
    interregional: 'Межрегиональные',
    regional: 'Региональные'
  };
  return map[level] || level;
}

export function typeName(id) {
  if (!state.dict) return id;
  const t = state.dict.competitionTypes.find((x) => x.id === id);
  return t ? t.name : id;
}

export function roleName(role) {
  const map = {
    federation: 'Федерация',
    athlete: 'Спортсмен',
    trainer: 'Тренер',
    judge: 'Судья',
    ministry: 'Министерство'
  };
  return map[role] || role;
}

export function formatName(format) {
  const map = { offline: 'очно', online: 'онлайн', mixed: 'смешанный' };
  return map[format] || format;
}

export function ageGroupLabel(code) {
  if (!state.dict) return code;
  const g = state.dict.ageGroups.find((x) => x.code === code);
  return g ? g.code : code;
}
