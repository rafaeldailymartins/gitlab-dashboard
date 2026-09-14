import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, CAMILA, DIEGO, entry, member } from '~tests/support/gitlab-group-timelogs'

import { people } from './roster'

const MAY = '2026-05-12T15:00:00Z'

function names(rows: readonly { person: { name: string } }[]): string[] {
  return rows.map((row) => row.person.name)
}

describe('people', () => {
  it('gives a member who logged nothing a row, which is the point of the screen', () => {
    const rows = people([member(CAMILA)], [])

    expect(names(rows)).toEqual([CAMILA.name])
    expect(rows[0]?.onRoster).toBe(true)
  })

  it('gives a row to somebody who logged time and is not on the membership', () => {
    const rows = people([member(ANA)], [entry(DIEGO, MAY, 3600)])

    expect(names(rows)).toEqual([ANA.name, DIEGO.name])
    expect(rows.find((row) => row.person.name === DIEGO.name)?.onRoster).toBe(false)
  })

  it('does not duplicate a member who also logged time', () => {
    expect(people([member(ANA)], [entry(ANA, MAY, 3600), entry(ANA, MAY, 60)])).toHaveLength(1)
  })

  it('drops a bot from the membership', () => {
    expect(people([member(ANA), member(BRUNO, { bot: true })], [])).toHaveLength(1)
  })

  it('drops an account that is not active from the membership', () => {
    expect(people([member(ANA), member(BRUNO, { active: false })], [])).toHaveLength(1)
  })

  it('keeps a blocked account that logged time, because the hours are still real', () => {
    const rows = people([member(BRUNO, { active: false })], [entry(BRUNO, MAY, 3600)])

    expect(names(rows)).toEqual([BRUNO.name])
    expect(rows[0]?.onRoster).toBe(false)
  })

  it('keeps a bot that logged time, for the same reason', () => {
    expect(people([member(ANA, { bot: true })], [entry(ANA, MAY, 3600)])).toHaveLength(1)
  })

  it('orders by name', () => {
    const rows = people([member(CAMILA), member(ANA), member(BRUNO)], [])

    expect(names(rows)).toEqual([ANA.name, BRUNO.name, CAMILA.name])
  })

  it('breaks a tie on the same name with the username, whichever order they arrive in', () => {
    const twin = { ...BRUNO, id: 'gid://gitlab/User/999', username: 'a.twin' }
    const ordered = ['a.twin', BRUNO.username]

    expect(people([member(BRUNO), member(twin)], []).map((row) => row.person.username)).toEqual(
      ordered,
    )
    expect(people([member(twin), member(BRUNO)], []).map((row) => row.person.username)).toEqual(
      ordered,
    )
  })

  it('orders by name whichever order the names arrive in', () => {
    const forwards = people([member(ANA), member(CAMILA)], []).map((row) => row.person.name)
    const backwards = people([member(CAMILA), member(ANA)], []).map((row) => row.person.name)

    expect(forwards).toEqual([ANA.name, CAMILA.name])
    expect(backwards).toEqual(forwards)
  })

  it('tells two people apart by id, not by username', () => {
    const renamed = { ...ANA, id: 'gid://gitlab/User/777', name: 'Ana Renamed' }

    expect(people([member(ANA), member(renamed)], [])).toHaveLength(2)
  })

  it('returns nothing when there is neither a membership nor an entry', () => {
    expect(people([], [])).toEqual([])
  })
})
