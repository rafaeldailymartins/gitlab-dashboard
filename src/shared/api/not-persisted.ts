/**
 * Marks an answer as one that must not reach the device.
 *
 * Carried by every query that holds somebody other than the reader — a team's
 * hours, the people a search offers, the roster itself — because a shared or
 * borrowed machine would otherwise show them to whoever opens the app next. It
 * travels on the query rather than as a key the persister has to recognise, so
 * the rule lives with the thing it is about.
 *
 * Here and not in either slice that uses it: one entity may not import another,
 * so a constant kept in one of them is a copy kept in the other, and
 * `persist: false` is a rule, not a default — a second copy of it is a second
 * place it can be forgotten.
 */
export const NOT_PERSISTED = { persist: false }
