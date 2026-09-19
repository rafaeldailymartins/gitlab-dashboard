import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import {
  ANA,
  BRUNO,
  CAMILA,
  DIEGO,
  member,
  suggestedMember,
} from '~tests/support/gitlab-team-timelogs'

import type { MemberIdentity } from '@/entities/team-timelogs/model/identity'
import type { Person, SuggestedMember } from '@/entities/team-timelogs/model/types'
import type { Team, TeamMember } from '@/entities/teams/model/team'

import { identityLookup } from '@/entities/team-timelogs/model/identity'
import { suggestionsFrom } from '@/entities/team-timelogs/model/suggestions'
import {
  newTeam,
  withMember,
  withName,
  withoutMember,
  withoutTeam,
  withTeam,
  withUpdated,
} from '@/entities/teams/model/edits'
import {
  decodeTeams,
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
  MAX_TEAMS,
  orderedMembers,
  TEAMS_VERSION,
} from '@/entities/teams/model/team'

/** What a scenario has said so far: the reader's teams, a document, and who logged. */
interface World {
  /**
   * The team, and the list, an edit was applied to.
   *
   * A refused edit returns the very thing it was given, so keeping it is what
   * lets a scenario say "unchanged" as identity rather than as deep equality —
   * which an edit that rebuilt the team out of its own parts would satisfy too.
   */
  before: null | Team
  beforeTeams: null | readonly Team[]
  /** Whoever the provider says logged time in the group. */
  observed: readonly SuggestedMember[]
  /** Whoever the provider resolved when asked about the people on the team. */
  resolved: readonly Person[]
  /** A document as the store holds it, including the parts of it that are not teams. */
  stored: readonly unknown[]
  teams: readonly Team[]
}

const feature = await loadFeature('features/domain/keep-a-team.feature')

const MADE_AT = '2026-09-18T14:30:00.000Z'
const LATER = '2026-09-19T09:00:00.000Z'

const PEOPLE: Record<string, Person> = { Ana: ANA, Bruno: BRUNO, Camila: CAMILA, Diego: DIEGO }

/** An account that logs time and whose timesheet nobody manages. */
const DEPENDENCY_BOT: Person = {
  id: 'gid://gitlab/User/2318749',
  name: 'Dependency Bot',
  username: 'dependency-bot',
  webUrl: 'https://gitlab.com/dependency-bot',
}

/**
 * The step text, declared once per line a scenario has of it.
 *
 * vitest-cucumber consumes one declaration per step, and two identical
 * declarations in one scenario collapse into one — which is why a scenario that
 * adds twice says "also" the second time.
 */
const ADDS = 'the reader adds {string}'
const ALSO_ADDS = 'the reader also adds {string}'
const KEEPS = 'the reader keeps the teams {string}'
const LISTS = 'the team lists {string}'
const NAMED = 'a team named {string}'
const OFFERS = 'the suggestions offer {string}'
const READ_BACK = 'the teams are read back'
const SECOND = 'a second team named {string}'
const UNCHANGED = 'the team is the one the reader already had'
const WHO_LOGGED = 'the people who logged time in the group are {string}'

/** The list with one more person on the team a scenario is editing. */
function afterAdding(teams: readonly Team[], one: TeamMember): readonly Team[] {
  return withUpdated(teams, withMember(firstOf(teams), one, LATER))
}

function afterRemoving(teams: readonly Team[], name: string): readonly Team[] {
  return withUpdated(teams, withoutMember(firstOf(teams), memberOf(name).id, LATER))
}

function afterRenaming(teams: readonly Team[], name: string): readonly Team[] {
  return withUpdated(teams, withName(firstOf(teams), name, LATER))
}

/** A team at the member ceiling, reached the way the reader would reach it. */
function crowdedTeam(): Team {
  let team = newTeam(identifier(1), 'Squad Fiscal', MADE_AT)

  for (let index = 0; index < MAX_MEMBERS; index += 1) {
    team = withMember(team, { ...member(ANA), id: `gid://gitlab/User/${String(index)}` }, MADE_AT)
  }

  return team
}

function decoded(stored: readonly unknown[]): readonly Team[] {
  return decodeTeams(JSON.stringify({ teams: stored, version: TEAMS_VERSION }))
}

/** The names a scenario's list refers to, resolved through the fixtures. */
function expectedNames(list: string): string[] {
  return namesFrom(list).map((name) => personOf(name).name)
}

/** The team a scenario is talking about, which is always the first one it made. */
function firstOf(teams: readonly Team[]): Team {
  const [team] = teams

  if (!team) {
    throw new Error('The scenario has made no team')
  }

  return team
}

function identifier(index: number): string {
  return `0193f2c1-8a7e-7f3a-9c21-${String(index).padStart(12, '0')}`
}

/** What the provider says about somebody the team names, asked by identifier. */
function identityOf(resolved: readonly Person[], name: string): MemberIdentity {
  return identityLookup(resolved)(memberOf(name))
}

function idOfNamed(teams: readonly Team[], name: string): string {
  return teams.find((one) => one.name === name)?.id ?? ''
}

function inactive(name: string): SuggestedMember {
  return suggestedMember(personOf(name), { active: false })
}

/** The same person as the provider now addresses them, after a rename. */
function inAnotherHandle(name: string): SuggestedMember {
  return suggestedMember(renamed(name))
}

function listedHandles(teams: readonly Team[]): string[] {
  return orderedMembers(firstOf(teams)).map((one) => one.username)
}

/** Every name the team shows, in the order it shows them. */
function listedNames(teams: readonly Team[]): string[] {
  return orderedMembers(firstOf(teams)).map((one) => one.name)
}

/** The reader's list at its ceiling. */
function manyTeams(): readonly Team[] {
  return Array.from({ length: MAX_TEAMS }, (_one, index) =>
    newTeam(identifier(index), 'Squad', MADE_AT),
  )
}

function memberOf(name: string): TeamMember {
  return member(personOf(name))
}

function namesFrom(list: string): string[] {
  return list
    .split(/,| and /)
    .map((raw) => raw.trim())
    .filter((name) => name !== '')
}

function offeredNames(observed: readonly SuggestedMember[]): string[] {
  return suggestionsFrom(observed).map((one) => one.person.name)
}

function personOf(name: string): Person {
  const person = PEOPLE[name]

  if (!person) {
    throw new Error(`No fixture for ${name}`)
  }

  return person
}

/** Somebody the provider resolves for the identifier it was given, under a new handle. */
function renamed(name: string): Person {
  const person = personOf(name)

  return { ...person, username: `${person.username}.again` }
}

/** The people a scenario names, with something that is not a member among them. */
function storedHolding(list: string): readonly unknown[] {
  const [first, ...rest] = namesFrom(list).map((name) => memberOf(name))

  return [storedTeam('Squad Fiscal', [first, 'not a member', ...rest])]
}

function storedNaming(name: string): readonly unknown[] {
  return [storedTeam(name, [memberOf('Ana')]), 'not a team']
}

/** A team as the store holds it, before anything has decided it is readable. */
function storedTeam(name: string, members: readonly unknown[]) {
  return { id: identifier(1), members, name, updatedAt: MADE_AT }
}

/** One person written twice, under the handle they had and the one they took. */
function storedTwice(name: string): readonly unknown[] {
  const one = memberOf(name)

  return [storedTeam('Squad Fiscal', [one, { ...one, username: `${one.username}.2` }])]
}

function suggestionsOf(list: string): readonly SuggestedMember[] {
  return namesFrom(list).map((name) => suggestedMember(personOf(name)))
}

/** Every team the reader keeps, in the order they made them. */
function teamNames(teams: readonly Team[]): string[] {
  return teams.map((one) => one.name)
}

/** Somebody the provider resolves to a different person under the same name. */
function twinOf(name: string): TeamMember {
  const person = personOf(name)

  return { id: `${person.id}0`, name: person.name, username: `${person.username}.2` }
}

/** One more team, under an identifier no team in the list already has. */
function withSecond(teams: readonly Team[], name: string): readonly Team[] {
  return withTeam(teams, newTeam(identifier(teams.length + 1), name, LATER))
}

function world(): World {
  return { before: null, beforeTeams: null, observed: [], resolved: [], stored: [], teams: [] }
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('Making a team and putting people on it', ({ And, Given, Then }) => {
    const state = world()

    Given(NAMED, (_context, name: string) => {
      state.teams = [newTeam(identifier(1), name, MADE_AT)]
    })

    And(ADDS, (_context, name: string) => {
      state.teams = afterAdding(state.teams, memberOf(name))
    })

    And(ALSO_ADDS, (_context, name: string) => {
      state.teams = afterAdding(state.teams, memberOf(name))
    })

    Then(LISTS, (_context, list: string) => {
      expect(listedNames(state.teams)).toEqual(expectedNames(list))
    })
  })

  Scenario(
    'Adding somebody already on the team leaves it as it was',
    ({ And, Given, Then, When }) => {
      const state = world()

      Given(NAMED, (_context, name: string) => {
        state.teams = [newTeam(identifier(1), name, MADE_AT)]
      })

      And(ADDS, (_context, name: string) => {
        state.teams = afterAdding(state.teams, memberOf(name))
      })

      When(
        'the reader adds {string} again under the name they now go by',
        (_context, name: string) => {
          const person = personOf(name)

          state.before = firstOf(state.teams)
          state.teams = afterAdding(state.teams, {
            ...member(person),
            name: `${person.name} (renamed)`,
          })
        },
      )

      Then(UNCHANGED, () => {
        expect(firstOf(state.teams)).toBe(state.before)
      })

      And(LISTS, (_context, list: string) => {
        expect(listedNames(state.teams)).toEqual(expectedNames(list))
      })
    },
  )

  Scenario('Taking somebody off a team', ({ And, Given, Then, When }) => {
    const state = world()

    Given(NAMED, (_context, name: string) => {
      state.teams = [newTeam(identifier(1), name, MADE_AT)]
    })

    And(ADDS, (_context, name: string) => {
      state.teams = afterAdding(state.teams, memberOf(name))
    })

    And(ALSO_ADDS, (_context, name: string) => {
      state.teams = afterAdding(state.teams, memberOf(name))
    })

    When('the reader takes {string} off the team', (_context, name: string) => {
      state.teams = afterRemoving(state.teams, name)
    })

    Then(LISTS, (_context, list: string) => {
      expect(listedNames(state.teams)).toEqual(expectedNames(list))
    })
  })

  Scenario(
    'Renaming a team keeps the identifier an address names',
    ({ And, Given, Then, When }) => {
      const state = world()

      Given(NAMED, (_context, name: string) => {
        state.teams = [newTeam(identifier(1), name, MADE_AT)]
      })

      When('the reader renames it {string}', (_context, name: string) => {
        state.teams = afterRenaming(state.teams, name)
      })

      Then('the team is named {string}', (_context, name: string) => {
        expect(firstOf(state.teams).name).toBe(name)
      })

      And("the team's identifier is the one it was made with", () => {
        expect(firstOf(state.teams).id).toBe(identifier(1))
      })
    },
  )

  Scenario('The reader keeps more than one team', ({ And, Given, Then }) => {
    const state = world()

    Given(NAMED, (_context, name: string) => {
      state.teams = [newTeam(identifier(1), name, MADE_AT)]
    })

    And(SECOND, (_context, name: string) => {
      state.teams = withSecond(state.teams, name)
    })

    Then(KEEPS, (_context, list: string) => {
      expect(teamNames(state.teams)).toEqual(namesFrom(list))
    })
  })

  Scenario('Deleting one team leaves the rest', ({ And, Given, Then, When }) => {
    const state = world()

    Given(NAMED, (_context, name: string) => {
      state.teams = [newTeam(identifier(1), name, MADE_AT)]
    })

    And(SECOND, (_context, name: string) => {
      state.teams = withSecond(state.teams, name)
    })

    When('the reader deletes {string}', (_context, name: string) => {
      state.teams = withoutTeam(state.teams, idOfNamed(state.teams, name))
    })

    Then(KEEPS, (_context, list: string) => {
      expect(teamNames(state.teams)).toEqual(namesFrom(list))
    })
  })

  Scenario(
    "The people on a team are read in one order, whatever the reader's locale",
    ({ And, Given, Then }) => {
      const state = world()

      Given(NAMED, (_context, name: string) => {
        state.teams = [newTeam(identifier(1), name, MADE_AT)]
      })

      And(ADDS, (_context, name: string) => {
        state.teams = afterAdding(state.teams, memberOf(name))
      })

      And(ALSO_ADDS, (_context, name: string) => {
        state.teams = afterAdding(state.teams, memberOf(name))
      })

      And(
        'the reader adds somebody who goes by the same name as {string}',
        (_context, name: string) => {
          state.teams = afterAdding(state.teams, twinOf(name))
        },
      )

      Then('the team lists the handles {string}', (_context, list: string) => {
        expect(listedHandles(state.teams)).toEqual(namesFrom(list))
      })
    },
  )

  Scenario(
    'A name longer than the store accepts is refused before the round trip',
    ({ Given, Then, When }) => {
      const state = world()

      Given(NAMED, (_context, name: string) => {
        state.teams = [newTeam(identifier(1), name, MADE_AT)]
      })

      When('the reader renames it to something longer than the store accepts', () => {
        state.before = firstOf(state.teams)
        state.teams = afterRenaming(state.teams, 'a'.repeat(MAX_NAME_LENGTH + 1))
      })

      Then(UNCHANGED, () => {
        expect(firstOf(state.teams)).toBe(state.before)
      })
    },
  )

  Scenario('A team refuses to grow past the ceiling it states', ({ Given, Then, When }) => {
    const state = world()

    Given('a team holding the most people a team may', () => {
      state.teams = [crowdedTeam()]
    })

    When(ADDS, (_context, name: string) => {
      state.before = firstOf(state.teams)
      state.teams = afterAdding(state.teams, memberOf(name))
    })

    Then(UNCHANGED, () => {
      expect(firstOf(state.teams)).toBe(state.before)
    })
  })

  Scenario(
    "The reader's list refuses to grow past the ceiling it states",
    ({ Given, Then, When }) => {
      const state = world()

      Given('the most teams a reader may keep', () => {
        state.teams = manyTeams()
      })

      When('the reader starts one more team', () => {
        state.beforeTeams = state.teams
        state.teams = withSecond(state.teams, 'One more')
      })

      Then('the list is the one the reader already had', () => {
        expect(state.teams).toBe(state.beforeTeams)
      })
    },
  )

  Scenario(
    'One unreadable member costs the reader that member and not the team',
    ({ Given, Then, When }) => {
      const state = world()

      Given(
        'a stored team holding {string} and a fragment that is not a member',
        (_context, list: string) => {
          state.stored = storedHolding(list)
        },
      )

      When(READ_BACK, () => {
        state.teams = decoded(state.stored)
      })

      Then(LISTS, (_context, list: string) => {
        expect(listedNames(state.teams)).toEqual(expectedNames(list))
      })
    },
  )

  Scenario(
    'One unreadable team costs the reader that team and not the rest',
    ({ Given, Then, When }) => {
      const state = world()

      Given(
        'a stored team named {string} and a fragment that is not a team',
        (_context, name: string) => {
          state.stored = storedNaming(name)
        },
      )

      When(READ_BACK, () => {
        state.teams = decoded(state.stored)
      })

      Then(KEEPS, (_context, list: string) => {
        expect(teamNames(state.teams)).toEqual(namesFrom(list))
      })
    },
  )

  Scenario(
    'Two stored members sharing an identifier are read back as one',
    ({ Given, Then, When }) => {
      const state = world()

      Given(
        'a stored team holding {string} twice, the second time under another handle',
        (_context, name: string) => {
          state.stored = storedTwice(name)
        },
      )

      When(READ_BACK, () => {
        state.teams = decoded(state.stored)
      })

      Then(LISTS, (_context, list: string) => {
        expect(listedNames(state.teams)).toEqual(expectedNames(list))
      })
    },
  )

  Scenario(
    'A member the provider resolved under another handle is still that member',
    ({ And, Given, Then, When }) => {
      const state = world()

      Given(NAMED, (_context, name: string) => {
        state.teams = [newTeam(identifier(1), name, MADE_AT)]
      })

      And(ADDS, (_context, name: string) => {
        state.teams = afterAdding(state.teams, memberOf(name))
      })

      When(
        'the provider resolves {string} under the handle they changed to',
        (_context, name: string) => {
          state.resolved = [renamed(name)]
        },
      )

      Then(
        '{string} is confirmed, under the handle the provider now gives',
        (_context, name: string) => {
          expect(identityOf(state.resolved, name)).toEqual({
            kind: 'confirmed',
            person: renamed(name),
          })
        },
      )
    },
  )

  Scenario(
    'Members are matched by identifier, so a shorter answer misplaces nobody',
    ({ And, Given, Then, When }) => {
      const state = world()

      Given(NAMED, (_context, name: string) => {
        state.teams = [newTeam(identifier(1), name, MADE_AT)]
      })

      And(ADDS, (_context, name: string) => {
        state.teams = afterAdding(state.teams, memberOf(name))
      })

      And(ALSO_ADDS, (_context, name: string) => {
        state.teams = afterAdding(state.teams, memberOf(name))
      })

      When('the provider resolves nobody but {string}', (_context, name: string) => {
        state.resolved = [personOf(name)]
      })

      Then('{string} is unresolved', (_context, name: string) => {
        expect(identityOf(state.resolved, name)).toEqual({ kind: 'unresolved' })
      })

      And('{string} is confirmed', (_context, name: string) => {
        expect(identityOf(state.resolved, name)).toEqual({
          kind: 'confirmed',
          person: personOf(name),
        })
      })
    },
  )

  Scenario('Somebody who logged under two handles is offered once', ({ And, Given, Then }) => {
    const state = world()

    Given(WHO_LOGGED, (_context, list: string) => {
      state.observed = suggestionsOf(list)
    })

    And(
      '{string} logged there again under the handle they changed to',
      (_context, name: string) => {
        state.observed = [...state.observed, inAnotherHandle(name)]
      },
    )

    Then('one person is offered', () => {
      expect(offeredNames(state.observed)).toHaveLength(1)
    })

    And(OFFERS, (_context, list: string) => {
      expect(offeredNames(state.observed)).toEqual(expectedNames(list))
    })
  })

  Scenario('A bot that logged time is not offered', ({ And, Given, Then }) => {
    const state = world()

    Given(WHO_LOGGED, (_context, list: string) => {
      state.observed = suggestionsOf(list)
    })

    And('a bot logged time there too', () => {
      state.observed = [...state.observed, suggestedMember(DEPENDENCY_BOT, { bot: true })]
    })

    Then(OFFERS, (_context, list: string) => {
      expect(offeredNames(state.observed)).toEqual(expectedNames(list))
    })
  })

  Scenario(
    'Somebody whose account is no longer active is offered all the same',
    ({ And, Given, Then }) => {
      const state = world()

      Given(WHO_LOGGED, (_context, list: string) => {
        state.observed = suggestionsOf(list)
      })

      And(
        '{string} logged there before their account stopped being active',
        (_context, name: string) => {
          state.observed = [...state.observed, inactive(name)]
        },
      )

      Then(OFFERS, (_context, list: string) => {
        expect(offeredNames(state.observed)).toEqual(expectedNames(list))
      })
    },
  )

  Scenario(
    "The suggestions are offered in one order, whatever the reader's locale",
    ({ Given, Then }) => {
      const state = world()

      Given(WHO_LOGGED, (_context, list: string) => {
        state.observed = suggestionsOf(list)
      })

      Then(OFFERS, (_context, list: string) => {
        expect(offeredNames(state.observed)).toEqual(expectedNames(list))
      })
    },
  )
})
