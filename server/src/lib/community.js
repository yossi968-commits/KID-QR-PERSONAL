/**
 * The app adapts to the family's community: which occasions it offers, which goals it
 * suggests and which investment track it highlights. The family picks it (and can change
 * it); nothing is inferred.
 */
export const COMMUNITIES = ['general', 'dati_leumi', 'haredi', 'arab'];

/** Occasions to open a gift campaign for, most relevant first. */
export const COMMUNITY_EVENTS = {
  general: ['birthday', 'brit', 'brita', 'bar_mitzvah', 'bat_mitzvah', 'driving', 'enlistment', 'graduation', 'wedding', 'holiday', 'other'],
  dati_leumi: ['birthday', 'brit', 'brita', 'siddur', 'chumash', 'bar_mitzvah', 'tefillin', 'bat_mitzvah', 'mechina', 'enlistment', 'graduation', 'wedding', 'holiday', 'other'],
  haredi: ['brit', 'upsherin', 'siddur', 'chumash', 'tefillin', 'bar_mitzvah', 'bat_mitzvah', 'yeshiva', 'wedding', 'holiday', 'birthday', 'other'],
  arab: ['birthday', 'aqiqa', 'eid', 'graduation', 'driving', 'university', 'wedding', 'holiday', 'other'],
};

/** Goal suggestions (amounts in agorot, age the money is needed). */
export const COMMUNITY_GOALS = {
  general: [['bike', '🚲', 80000, 8], ['laptop', '💻', 400000, 15], ['driving', '🚗', 700000, 17], ['trip', '✈️', 1000000, 21], ['degree', '🎓', 4000000, 21], ['apartment', '🏠', 15000000, 30]],
  dati_leumi: [['tefillin', '📿', 350000, 13], ['bat_mitzvah_gift', '🎁', 300000, 12], ['mechina', '🏕️', 1500000, 18], ['driving', '🚗', 700000, 17], ['degree', '🎓', 4000000, 22], ['wedding', '💍', 5000000, 23], ['apartment', '🏠', 15000000, 28]],
  haredi: [['tefillin', '📿', 450000, 13], ['tallit', '🧣', 120000, 13], ['seforim', '📚', 600000, 16], ['yeshiva', '🏫', 1200000, 17], ['wedding', '💍', 8000000, 20], ['apartment', '🏠', 20000000, 22]],
  arab: [['bike', '🚲', 80000, 8], ['laptop', '💻', 400000, 15], ['driving', '🚗', 700000, 17], ['degree', '🎓', 5000000, 21], ['wedding', '💍', 8000000, 25], ['apartment', '🏠', 15000000, 28]],
};

/** A track that fits the community's values, offered first (where a house runs one). */
export const COMMUNITY_TRACK = { haredi: 'halacha', dati_leumi: 'halacha', arab: 'sharia' };

export const normalizeCommunity = (c) => (COMMUNITIES.includes(c) ? c : 'general');

export function communityView(c) {
  const id = normalizeCommunity(c);
  return {
    id,
    events: COMMUNITY_EVENTS[id],
    goals: COMMUNITY_GOALS[id].map(([key, icon, amount, age]) => ({ key, icon, amount, age })),
    track: COMMUNITY_TRACK[id] || null,
  };
}
