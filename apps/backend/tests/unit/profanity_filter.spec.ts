import { test } from '@japa/runner'
import { censorMessage } from '#services/profanity_filter'

test.group('Profanity filter', () => {
  test('masks blocked words preserving length', ({ assert }) => {
    const result = censorMessage('what the fuck is this')
    assert.equal(result.text, 'what the **** is this')
    assert.isTrue(result.wasCensored)
  })

  test('is case-insensitive', ({ assert }) => {
    const result = censorMessage('SHIT happens')
    assert.equal(result.text, '**** happens')
    assert.isTrue(result.wasCensored)
  })

  test('masks racial slurs', ({ assert }) => {
    const result = censorMessage('you nigger')
    assert.equal(result.text, 'you ******')
    assert.isTrue(result.wasCensored)
  })

  test('only matches whole words, not substrings', ({ assert }) => {
    // "Scunthorpe problem": clean words containing blocked substrings
    const result = censorMessage('the class at Scunthorpe was shitting on assessments')
    assert.equal(result.text, 'the class at Scunthorpe was shitting on assessments')
    assert.isFalse(result.wasCensored)
  })

  test('leaves clean messages untouched', ({ assert }) => {
    const result = censorMessage('good game, well played!')
    assert.equal(result.text, 'good game, well played!')
    assert.isFalse(result.wasCensored)
  })

  test('masks multiple occurrences', ({ assert }) => {
    const result = censorMessage('shit shit SHIT')
    assert.equal(result.text, '**** **** ****')
    assert.isTrue(result.wasCensored)
  })
})
